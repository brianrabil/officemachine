const std = @import("std");
const json = @import("json");
const runner = @import("runner");
const native_sdk = @import("native_sdk");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);

const App = struct {
    env_map: *std.process.Environ.Map,
    io: std.Io,

    fn app(self: *@This()) native_sdk.App {
        return .{
            .context = self,
            .name = "video-editor",
            .source = native_sdk.frontend.productionSource(.{
                .dist = "frontend/dist",
                .entry = "index.html",
            }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!native_sdk.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return native_sdk.frontend.sourceFromEnv(self.env_map, .{
            .dist = "frontend/dist",
            .entry = "index.html",
        });
    }

    fn readProject(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        const self: *@This() = @ptrCast(@alignCast(context));
        const storage_bytes = try std.heap.page_allocator.alloc(u8, invocation.request.payload.len);
        defer std.heap.page_allocator.free(storage_bytes);
        var storage = json.StringStorage.init(storage_bytes);
        const path = json.stringField(invocation.request.payload, "path", &storage) orelse return error.InvalidProjectPath;
        if (!std.mem.endsWith(u8, path, ".omvideo") and !std.mem.endsWith(u8, path, ".json")) return error.InvalidProjectPath;

        const contents = try std.Io.Dir.cwd().readFileAlloc(self.io, path, std.heap.page_allocator, .limited(512 * 1024));
        defer std.heap.page_allocator.free(contents);
        const response = native_sdk.bridge.writeJsonStringValue(output, contents);
        if (response.len == 0) return error.ProjectTooLarge;
        return response;
    }

    fn writeProject(context: *anyopaque, invocation: native_sdk.bridge.Invocation, _: []u8) anyerror![]const u8 {
        const self: *@This() = @ptrCast(@alignCast(context));
        const storage_bytes = try std.heap.page_allocator.alloc(u8, invocation.request.payload.len);
        defer std.heap.page_allocator.free(storage_bytes);
        var storage = json.StringStorage.init(storage_bytes);
        const path = json.stringField(invocation.request.payload, "path", &storage) orelse return error.InvalidProjectPath;
        const contents = json.stringField(invocation.request.payload, "contents", &storage) orelse return error.InvalidProjectContents;
        if (!std.mem.endsWith(u8, path, ".omvideo")) return error.InvalidProjectPath;
        if (!json.isValidValue(contents)) return error.InvalidProjectContents;

        try std.Io.Dir.cwd().writeFile(self.io, .{ .sub_path = path, .data = contents });
        return "true";
    }

    fn scanDirectory(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        const self: *@This() = @ptrCast(@alignCast(context));
        const storage_bytes = try std.heap.page_allocator.alloc(u8, invocation.request.payload.len);
        defer std.heap.page_allocator.free(storage_bytes);
        var storage = json.StringStorage.init(storage_bytes);
        const path = json.stringField(invocation.request.payload, "path", &storage) orelse return error.InvalidDirectoryPath;
        if (!std.fs.path.isAbsolute(path)) return error.InvalidDirectoryPath;

        var directory = try std.Io.Dir.openDirAbsolute(self.io, path, .{
            .iterate = true,
        });
        defer directory.close(self.io);

        var walker = try directory.walkSelectively(std.heap.page_allocator);
        defer walker.deinit();

        var writer = std.Io.Writer.fixed(output);
        try writer.writeByte('[');
        var entry_count: usize = 0;
        while (try walker.next(self.io)) |entry| {
            const ignored_directory = entry.kind == .directory and
                (std.mem.eql(u8, entry.basename, ".git") or
                    std.mem.eql(u8, entry.basename, "node_modules") or
                    std.mem.eql(u8, entry.basename, ".next") or
                    std.mem.eql(u8, entry.basename, ".turbo") or
                    std.mem.eql(u8, entry.basename, ".zig-cache") or
                    std.mem.eql(u8, entry.basename, "zig-out"));
            if (ignored_directory) continue;
            if (entry_count == 10_000) return error.DirectoryTooLarge;

            if (entry_count > 0) try writer.writeByte(',');
            if (entry.kind == .directory) {
                var path_buffer: [std.Io.Dir.max_path_bytes]u8 = undefined;
                const path_with_separator = try std.fmt.bufPrint(&path_buffer, "{s}/", .{entry.path});
                try json.writeString(&writer, path_with_separator);
                try walker.enter(self.io, entry);
            } else {
                try json.writeString(&writer, entry.path);
            }
            entry_count += 1;
        }
        try writer.writeByte(']');
        return writer.buffered();
    }
};

const allowed_origins = [_][]const u8{ "zero://app", "http://127.0.0.1:5173" };
const filesystem_permission = [_][]const u8{native_sdk.security.permission_filesystem};
const dialog_permission = [_][]const u8{native_sdk.security.permission_dialog};
const runtime_permissions = [_][]const u8{
    native_sdk.security.permission_dialog,
    native_sdk.security.permission_filesystem,
};

pub fn main(init: std.process.Init) !void {
    var app = App{ .env_map = init.environ_map, .io = init.io };
    const handlers = [_]native_sdk.BridgeHandler{
        .{ .name = "video-editor.project.read", .context = &app, .invoke_fn = App.readProject },
        .{ .name = "video-editor.project.write", .context = &app, .invoke_fn = App.writeProject },
        .{ .name = "video-editor.directory.scan", .context = &app, .invoke_fn = App.scanDirectory },
    };
    const project_commands = [_]native_sdk.BridgeCommandPolicy{
        .{ .name = "video-editor.project.read", .permissions = &filesystem_permission, .origins = &allowed_origins },
        .{ .name = "video-editor.project.write", .permissions = &filesystem_permission, .origins = &allowed_origins },
        .{ .name = "video-editor.directory.scan", .permissions = &filesystem_permission, .origins = &allowed_origins },
    };
    const dialog_commands = [_]native_sdk.BridgeCommandPolicy{
        .{ .name = "native-sdk.dialog.openFile", .permissions = &dialog_permission, .origins = &allowed_origins },
        .{ .name = "native-sdk.dialog.saveFile", .permissions = &dialog_permission, .origins = &allowed_origins },
    };

    try runner.runWithOptions(app.app(), .{
        .app_name = "OfficeMachine Video",
        .window_title = "OfficeMachine Video",
        .bundle_id = "dev.native_sdk.video-editor",
        .icon_path = "assets/icon.png",
        .bridge = .{
            .policy = .{ .enabled = true, .permissions = &runtime_permissions, .commands = &project_commands },
            .registry = .{ .handlers = &handlers },
        },
        .builtin_bridge = .{ .enabled = true, .permissions = &dialog_permission, .commands = &dialog_commands },
        .security = .{
            .permissions = &runtime_permissions,
            .navigation = .{ .allowed_origins = &allowed_origins },
        },
    }, init);
}

test "production source points at the Vite build" {
    const source = native_sdk.frontend.productionSource(.{
        .dist = "frontend/dist",
        .entry = "index.html",
    });
    try std.testing.expectEqual(native_sdk.WebViewSourceKind.assets, source.kind);
    try std.testing.expectEqualStrings("frontend/dist", source.asset_options.?.root_path);
    try std.testing.expectEqualStrings("index.html", source.asset_options.?.entry);
}

test "project bridge rejects unsupported file extensions" {
    var env = std.process.Environ.Map.init(std.testing.allocator);
    defer env.deinit();
    var app = App{ .env_map = &env, .io = std.testing.io };
    var output: [128]u8 = undefined;

    try std.testing.expectError(error.InvalidProjectPath, App.readProject(&app, .{
        .request = .{ .id = "read", .command = "video-editor.project.read", .payload = "{\"path\":\"project.txt\"}" },
        .source = .{ .origin = "zero://app" },
    }, &output));
    try std.testing.expectError(error.InvalidProjectPath, App.writeProject(&app, .{
        .request = .{ .id = "write", .command = "video-editor.project.write", .payload = "{\"path\":\"project.json\",\"contents\":\"{}\"}" },
        .source = .{ .origin = "zero://app" },
    }, &output));
}

test "directory bridge rejects relative paths" {
    var env = std.process.Environ.Map.init(std.testing.allocator);
    defer env.deinit();
    var app = App{ .env_map = &env, .io = std.testing.io };
    var output: [128]u8 = undefined;

    try std.testing.expectError(error.InvalidDirectoryPath, App.scanDirectory(&app, .{
        .request = .{ .id = "scan", .command = "video-editor.directory.scan", .payload = "{\"path\":\"relative/project\"}" },
        .source = .{ .origin = "zero://app" },
    }, &output));
}

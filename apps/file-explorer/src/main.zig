//! A native-rendered file explorer. The view lives in `app.native`; this file
//! owns the filesystem snapshot and the typed Native SDK update loop.

const std = @import("std");
const runner = @import("runner");
const native_sdk = @import("native_sdk");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);

const canvas = native_sdk.canvas;
const geometry = native_sdk.geometry;

const canvas_label = "main-canvas";
const window_width: f32 = 1120;
const window_height: f32 = 760;
const max_entries = 96;
const max_path_bytes = 1024;
const max_name_bytes = 256;
const max_error_bytes = 160;

const app_permissions = [_][]const u8{ native_sdk.security.permission_command, native_sdk.security.permission_view };
const shell_views = [_]native_sdk.ShellView{
    .{ .label = canvas_label, .kind = .gpu_surface, .fill = true, .role = "File explorer canvas", .accessibility_label = "File Explorer", .gpu_backend = .metal, .gpu_pixel_format = .bgra8_unorm, .gpu_present_mode = .timer, .gpu_alpha_mode = .@"opaque", .gpu_color_space = .srgb, .gpu_vsync = true },
};
const shell_windows = [_]native_sdk.ShellWindow{.{
    .label = "main",
    .title = "File Explorer",
    .width = window_width,
    .height = window_height,
    .restore_state = false,
    .titlebar = .hidden_inset_tall,
    .views = &shell_views,
}};
const shell_scene: native_sdk.ShellConfig = .{ .windows = &shell_windows };

// ------------------------------------------------------------------ model

pub const Msg = union(enum) {
    go_home,
    go_desktop,
    go_documents,
    go_downloads,
    go_developer,
    go_root,
    go_path: []const u8,
    go_up,
    refresh,
    show_grid,
    show_list,
    toggle_hidden,
    open_entry: usize,
    search_edit: canvas.TextInputEvent,
    resize_sidebar: f32,
};

const Entry = struct {
    id: usize = 0,
    name_storage: [max_name_bytes]u8 = [_]u8{0} ** max_name_bytes,
    name_len: usize = 0,
    is_directory: bool = false,
    size_bytes: u64 = 0,

    fn name(self: *const Entry) []const u8 {
        return self.name_storage[0..self.name_len];
    }
};

pub const VisibleEntry = struct {
    id: usize,
    name: []const u8,
    kind: []const u8,
    icon: []const u8,
    size: []const u8,
    selected: bool,
};

pub const BreadcrumbCrumb = struct {
    id: usize,
    label: []const u8,
    path: []const u8,
};

pub const Model = struct {
    pub const view_unbound = .{
        "current_path_len",
        "currentPath",
        "selected_entry",
        "is_truncated",
        "error_len",
        "search_buffer",
        "current_path_storage",
        "entries",
        "error_storage",
        "grid_view",
    };

    io: ?std.Io = null,
    current_path_storage: [max_path_bytes]u8 = [_]u8{0} ** max_path_bytes,
    current_path_len: usize = 0,
    entries: [max_entries]Entry = [_]Entry{.{}} ** max_entries,
    entry_count: usize = 0,
    selected_entry: ?usize = null,
    show_hidden: bool = false,
    grid_view: bool = true,
    is_truncated: bool = false,
    sidebar_fraction: f32 = 0.18,
    search_buffer: canvas.TextBuffer(128) = .{},
    error_storage: [max_error_bytes]u8 = [_]u8{0} ** max_error_bytes,
    error_len: usize = 0,

    pub fn currentPath(self: *const Model) []const u8 {
        return self.current_path_storage[0..self.current_path_len];
    }

    pub fn search(self: *const Model) []const u8 {
        return self.search_buffer.text();
    }

    pub fn currentFolderName(self: *const Model) []const u8 {
        const path = self.currentPath();
        if (std.mem.eql(u8, path, "/")) return "Macintosh HD";
        const separator = std.mem.lastIndexOfScalar(u8, path, '/') orelse return path;
        return path[separator + 1 ..];
    }

    pub fn gridView(self: *const Model) bool {
        return self.grid_view;
    }

    pub fn listView(self: *const Model) bool {
        return !self.grid_view;
    }

    pub fn breadcrumbs(self: *const Model, arena: std.mem.Allocator) []const BreadcrumbCrumb {
        const path = self.currentPath();
        const capacity = 1 + std.mem.count(u8, path, "/");
        const crumbs = arena.alloc(BreadcrumbCrumb, capacity) catch return &.{};
        crumbs[0] = .{ .id = 0, .label = "Macintosh HD", .path = "/" };
        if (path.len <= 1) return crumbs[0..1];

        var count: usize = 1;
        var consumed: usize = 1;
        var parts = std.mem.splitScalar(u8, path[1..], '/');
        while (parts.next()) |part| {
            if (part.len == 0) continue;
            consumed += part.len;
            crumbs[count] = .{
                .id = count,
                .label = part,
                .path = arena.dupe(u8, path[0..consumed]) catch return crumbs[0..count],
            };
            count += 1;
            consumed += 1;
        }
        return crumbs[0..count];
    }

    pub fn isHome(self: *const Model) bool {
        return std.mem.eql(u8, self.currentPath(), homeDirectory());
    }

    pub fn isDesktop(self: *const Model) bool {
        return self.isHomeChild("Desktop");
    }

    pub fn isDocuments(self: *const Model) bool {
        return self.isHomeChild("Documents");
    }

    pub fn isDownloads(self: *const Model) bool {
        return self.isHomeChild("Downloads");
    }

    pub fn isDeveloper(self: *const Model) bool {
        return self.isHomeChild("Developer");
    }

    pub fn isRoot(self: *const Model) bool {
        return std.mem.eql(u8, self.currentPath(), "/");
    }

    fn folderCount(self: *const Model) usize {
        var count: usize = 0;
        for (self.entries[0..self.entry_count]) |entry| {
            if (entry.is_directory) count += 1;
        }
        return count;
    }

    fn fileCount(self: *const Model) usize {
        return self.entry_count - self.folderCount();
    }

    pub fn visibleCount(self: *const Model) usize {
        var count: usize = 0;
        for (self.entries[0..self.entry_count]) |*entry| {
            if (containsIgnoreCase(entry.name(), self.search())) count += 1;
        }
        return count;
    }

    fn selectedKind(self: *const Model) []const u8 {
        const entry = self.selectedEntry() orelse return "";
        return if (entry.is_directory) "Folder" else fileKind(entry.name());
    }

    fn selectedSize(self: *const Model, arena: std.mem.Allocator) []const u8 {
        const entry = self.selectedEntry() orelse return "";
        return if (entry.is_directory) "--" else formatSize(arena, entry.size_bytes);
    }

    fn selectedPath(self: *const Model, arena: std.mem.Allocator) []const u8 {
        const entry = self.selectedEntry() orelse return "";
        const separator = if (self.currentPath().len == 1) "" else "/";
        return std.fmt.allocPrint(arena, "{s}{s}{s}", .{ self.currentPath(), separator, entry.name() }) catch "";
    }

    pub fn emptyMessage(self: *const Model) []const u8 {
        return if (self.search().len > 0) "No files match this search." else "This folder is empty.";
    }

    pub fn visibleEntries(self: *const Model, arena: std.mem.Allocator) []const VisibleEntry {
        const visible = arena.alloc(VisibleEntry, self.entry_count) catch return &.{};
        var count: usize = 0;

        for (self.entries[0..self.entry_count]) |*entry| {
            if (!containsIgnoreCase(entry.name(), self.search())) continue;
            visible[count] = .{
                .id = entry.id,
                .name = entry.name(),
                .kind = if (entry.is_directory) "Folder" else fileKind(entry.name()),
                .icon = if (entry.is_directory) "folder" else fileIcon(entry.name()),
                .size = if (entry.is_directory) "--" else formatSize(arena, entry.size_bytes),
                .selected = self.selected_entry != null and self.selected_entry.? == entry.id,
            };
            count += 1;
        }

        return visible[0..count];
    }

    pub fn summary(self: *const Model, arena: std.mem.Allocator) []const u8 {
        if (self.error_len > 0) {
            return std.fmt.allocPrint(arena, "Unable to open: {s}", .{self.error_storage[0..self.error_len]}) catch "Unable to open folder";
        }
        if (self.is_truncated) {
            return std.fmt.allocPrint(arena, "Showing the first {d} items", .{self.entry_count}) catch "Folder loaded";
        }
        if (self.selectedEntry()) |selected| {
            return std.fmt.allocPrint(arena, "{s} - {s} - {s} - {s}", .{
                selected.name(),
                self.selectedKind(),
                self.selectedSize(arena),
                self.selectedPath(arena),
            }) catch "Item selected";
        }
        if (self.search().len > 0) {
            return std.fmt.allocPrint(arena, "{d} of {d} items", .{ self.visibleCount(), self.entry_count }) catch "Folder filtered";
        }
        return std.fmt.allocPrint(arena, "{d} {s} - {d} {s} - {d} {s}", .{
            self.entry_count,
            if (self.entry_count == 1) "item" else "items",
            self.folderCount(),
            if (self.folderCount() == 1) "folder" else "folders",
            self.fileCount(),
            if (self.fileCount() == 1) "file" else "files",
        }) catch "Folder loaded";
    }

    fn selectedEntry(self: *const Model) ?*const Entry {
        const index = self.selected_entry orelse return null;
        if (index >= self.entry_count) return null;
        return &self.entries[index];
    }

    fn isHomeChild(self: *const Model, child: []const u8) bool {
        var path_buffer: [max_path_bytes]u8 = undefined;
        const path = std.fmt.bufPrint(&path_buffer, "{s}/{s}", .{ homeDirectory(), child }) catch return false;
        return std.mem.eql(u8, self.currentPath(), path);
    }

    fn loadDirectory(self: *Model, path: []const u8) void {
        const io = self.io orelse {
            self.setError("Filesystem unavailable");
            return;
        };
        if (path.len == 0 or path.len > self.current_path_storage.len) {
            self.setError("Path is too long");
            return;
        }

        std.mem.copyForwards(u8, self.current_path_storage[0..path.len], path);
        self.current_path_len = path.len;
        self.entry_count = 0;
        self.selected_entry = null;
        self.is_truncated = false;
        self.error_len = 0;

        var directory = std.Io.Dir.openDirAbsolute(io, path, .{ .iterate = true }) catch |err| {
            self.setError(@errorName(err));
            return;
        };
        defer directory.close(io);

        var iterator = directory.iterate();
        while (iterator.next(io) catch |err| {
            self.setError(@errorName(err));
            return;
        }) |item| {
            if (!self.show_hidden and item.name.len > 0 and item.name[0] == '.') continue;
            if (self.entry_count == self.entries.len) {
                self.is_truncated = true;
                break;
            }

            const entry = &self.entries[self.entry_count];
            if (item.name.len > entry.name_storage.len) continue;

            entry.* = .{
                .id = self.entry_count,
                .name_len = item.name.len,
                .is_directory = item.kind == .directory,
                .size_bytes = 0,
            };
            @memcpy(entry.name_storage[0..item.name.len], item.name);
            if (!entry.is_directory) {
                const metadata = directory.statFile(io, item.name, .{}) catch continue;
                entry.size_bytes = metadata.size;
            }
            self.entry_count += 1;
        }

        var index: usize = 1;
        while (index < self.entry_count) : (index += 1) {
            var cursor = index;
            while (cursor > 0 and entryComesBefore(&self.entries[cursor], &self.entries[cursor - 1])) : (cursor -= 1) {
                std.mem.swap(Entry, &self.entries[cursor], &self.entries[cursor - 1]);
            }
        }
        for (self.entries[0..self.entry_count], 0..) |*entry, index_after_sort| {
            entry.id = index_after_sort;
        }
    }

    fn setError(self: *Model, message: []const u8) void {
        const length = @min(message.len, self.error_storage.len);
        @memcpy(self.error_storage[0..length], message[0..length]);
        self.error_len = length;
    }
};

fn containsIgnoreCase(haystack: []const u8, needle: []const u8) bool {
    if (needle.len == 0) return true;
    if (needle.len > haystack.len) return false;

    var start: usize = 0;
    while (start <= haystack.len - needle.len) : (start += 1) {
        var offset: usize = 0;
        while (offset < needle.len and std.ascii.toLower(haystack[start + offset]) == std.ascii.toLower(needle[offset])) : (offset += 1) {}
        if (offset == needle.len) return true;
    }
    return false;
}

fn formatSize(arena: std.mem.Allocator, bytes: u64) []const u8 {
    if (bytes < 1024) return std.fmt.allocPrint(arena, "{d} B", .{bytes}) catch "";
    if (bytes < 1024 * 1024) return std.fmt.allocPrint(arena, "{d} KB", .{bytes / 1024}) catch "";
    if (bytes < 1024 * 1024 * 1024) return std.fmt.allocPrint(arena, "{d} MB", .{bytes / (1024 * 1024)}) catch "";
    return std.fmt.allocPrint(arena, "{d} GB", .{bytes / (1024 * 1024 * 1024)}) catch "";
}

fn fileKind(name: []const u8) []const u8 {
    const extension = std.fs.path.extension(name);
    if (std.ascii.eqlIgnoreCase(extension, ".zig")) return "Zig source";
    if (std.ascii.eqlIgnoreCase(extension, ".ts") or std.ascii.eqlIgnoreCase(extension, ".tsx") or std.ascii.eqlIgnoreCase(extension, ".js") or std.ascii.eqlIgnoreCase(extension, ".jsx")) return "Source code";
    if (std.ascii.eqlIgnoreCase(extension, ".md") or std.ascii.eqlIgnoreCase(extension, ".txt")) return "Text document";
    if (std.ascii.eqlIgnoreCase(extension, ".pdf")) return "PDF document";
    if (std.ascii.eqlIgnoreCase(extension, ".png") or std.ascii.eqlIgnoreCase(extension, ".jpg") or std.ascii.eqlIgnoreCase(extension, ".jpeg") or std.ascii.eqlIgnoreCase(extension, ".gif") or std.ascii.eqlIgnoreCase(extension, ".webp")) return "Image";
    if (std.ascii.eqlIgnoreCase(extension, ".zip") or std.ascii.eqlIgnoreCase(extension, ".tar") or std.ascii.eqlIgnoreCase(extension, ".gz")) return "Archive";
    if (std.ascii.eqlIgnoreCase(extension, ".json") or std.ascii.eqlIgnoreCase(extension, ".json5") or std.ascii.eqlIgnoreCase(extension, ".yaml") or std.ascii.eqlIgnoreCase(extension, ".yml")) return "Data file";
    return "File";
}

fn fileIcon(name: []const u8) []const u8 {
    const kind = fileKind(name);
    if (std.mem.eql(u8, kind, "Image")) return "eye";
    if (std.mem.eql(u8, kind, "Archive")) return "archive";
    if (std.mem.eql(u8, kind, "Source code") or std.mem.eql(u8, kind, "Zig source")) return "terminal";
    return "file-text";
}

fn entryComesBefore(left: *const Entry, right: *const Entry) bool {
    if (left.is_directory != right.is_directory) return left.is_directory;
    return std.mem.order(u8, left.name(), right.name()) == .lt;
}

fn homeDirectory() []const u8 {
    const home = std.c.getenv("HOME") orelse return "/";
    return std.mem.span(home);
}

fn loadHomeChild(model: *Model, child: []const u8) void {
    var path_buffer: [max_path_bytes]u8 = undefined;
    const path = std.fmt.bufPrint(&path_buffer, "{s}/{s}", .{ homeDirectory(), child }) catch {
        model.setError("Path is too long");
        return;
    };
    model.loadDirectory(path);
}

pub fn update(model: *Model, msg: Msg) void {
    switch (msg) {
        .go_home => model.loadDirectory(homeDirectory()),
        .go_desktop => loadHomeChild(model, "Desktop"),
        .go_documents => loadHomeChild(model, "Documents"),
        .go_downloads => loadHomeChild(model, "Downloads"),
        .go_developer => loadHomeChild(model, "Developer"),
        .go_root => model.loadDirectory("/"),
        .go_path => |path| model.loadDirectory(path),
        .go_up => {
            const path = model.currentPath();
            if (path.len <= 1) return;
            const parent_end = std.mem.lastIndexOfScalar(u8, path, '/').?;
            if (parent_end == 0) {
                model.loadDirectory("/");
            } else {
                model.loadDirectory(path[0..parent_end]);
            }
        },
        .refresh => model.loadDirectory(model.currentPath()),
        .show_grid => model.grid_view = true,
        .show_list => model.grid_view = false,
        .toggle_hidden => {
            model.show_hidden = !model.show_hidden;
            model.loadDirectory(model.currentPath());
        },
        .open_entry => |entry_id| {
            if (entry_id >= model.entry_count) return;
            const entry = &model.entries[entry_id];
            if (!entry.is_directory) {
                model.selected_entry = entry_id;
                return;
            }

            var child_path: [max_path_bytes]u8 = undefined;
            const separator = if (model.currentPath().len == 1) "" else "/";
            const path = std.fmt.bufPrint(&child_path, "{s}{s}{s}", .{ model.currentPath(), separator, entry.name() }) catch {
                model.setError("Path is too long");
                return;
            };
            model.loadDirectory(path);
        },
        .search_edit => |edit| model.search_buffer.apply(edit),
        .resize_sidebar => |fraction| model.sidebar_fraction = fraction,
    }
}

// ------------------------------------------------------------------- view

pub const AppUi = canvas.Ui(Msg);
pub const app_markup = @embedFile("app.native");

// -------------------------------------------------------------------- app

const CounterApp = native_sdk.UiApp(Model, Msg);

pub fn initialModel(io: std.Io) Model {
    var model: Model = .{ .io = io };
    model.loadDirectory(homeDirectory());
    return model;
}

pub fn main(init: std.process.Init) !void {
    // The app struct (and any real Model) is multi-MB: `create`
    // heap-allocates and constructs everything in place, so neither
    // ever rides the stack. Mutate `app_state.model` through the
    // pointer before running if boot state is not the default.
    const app_state = try CounterApp.create(std.heap.page_allocator, .{
        .name = "file-explorer",
        .scene = shell_scene,
        .canvas_label = canvas_label,
        .update = update,
        .markup = .{ .source = app_markup, .watch_path = "src/app.native", .io = init.io },
    });
    defer app_state.destroy();
    app_state.model = initialModel(init.io);

    try runner.runWithOptions(app_state.app(), .{
        .app_name = "file-explorer",
        .window_title = "File Explorer",
        .bundle_id = "dev.officemachine.file-explorer",
        .icon_path = "assets/icon.png",
        .default_frame = geometry.RectF.init(0, 0, window_width, window_height),
        .restore_state = false,
        .js_window_api = false,
        .security = .{
            .permissions = &app_permissions,
            .navigation = .{ .allowed_origins = &.{ "zero://inline", "zero://app" } },
        },
    }, init);
}

test {
    _ = @import("tests.zig");
}

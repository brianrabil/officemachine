const std = @import("std");
const native_sdk = @import("native_sdk");
const main = @import("main.zig");

const canvas = native_sdk.canvas;
const testing = std.testing;

const AppUi = main.AppUi;
const Model = main.Model;
const Msg = main.Msg;

const AppMarkup = canvas.MarkupView(Model, Msg);

fn buildTree(arena: std.mem.Allocator, model: *const Model) !AppUi.Tree {
    var view = try AppMarkup.init(arena, main.app_markup);
    var ui = AppUi.init(arena);
    const node = view.build(&ui, model) catch |err| {
        // Name the app.native position instead of leaving a bare error
        // trace: the usual causes are a binding without a matching
        // Model field or an on-* message without a Msg arm.
        if (err == error.MarkupBuild) {
            std.debug.print("app.native:{d}:{d}: {s}\n", .{ view.diagnostic.line, view.diagnostic.column, view.diagnostic.message });
        }
        return err;
    };
    return ui.finalize(node);
}

fn findByText(widget: canvas.Widget, kind: canvas.WidgetKind, text: []const u8) ?canvas.Widget {
    if (widget.kind == kind and std.mem.eql(u8, widget.text, text)) return widget;
    for (widget.children) |child| {
        if (findByText(child, kind, text)) |found| return found;
    }
    return null;
}

/// A miss fails the test with the mismatch spelled out instead of a
/// null-unwrap panic: the usual cause is app.native and this test
/// drifting apart after an edit.
fn expectByText(widget: canvas.Widget, kind: canvas.WidgetKind, text: []const u8) !canvas.Widget {
    return findByText(widget, kind, text) orelse {
        std.debug.print("no {t} with text \"{s}\" in the view - if you changed app.native, update this test to match\n", .{ kind, text });
        return error.WidgetNotFound;
    };
}

test "explorer controls drive the filesystem model through typed dispatch" {
    var arena_state = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena_state.deinit();
    const arena = arena_state.allocator();

    var threaded = std.Io.Threaded.init(testing.allocator, .{});
    defer threaded.deinit();
    var model = main.initialModel(threaded.io());

    var tree = try buildTree(arena, &model);
    _ = try expectByText(tree.root, .segmented_control, "Icons");
    const list_view = try expectByText(tree.root, .segmented_control, "List");
    main.update(&model, tree.msgForPointer(list_view.id, .up).?);

    tree = try buildTree(arena, &model);
    _ = try expectByText(tree.root, .data_cell, "Name");
    _ = try expectByText(tree.root, .data_cell, "Kind");
    _ = try expectByText(tree.root, .data_cell, "Size");

    const home = try expectByText(tree.root, .list_item, "Home");
    main.update(&model, tree.msgForPointer(home.id, .up).?);
    try testing.expect(model.currentPath().len > 1);

    tree = try buildTree(arena, &model);
    try testing.expectEqual(home.id, (try expectByText(tree.root, .list_item, "Home")).id);

    const computer = try expectByText(tree.root, .list_item, "Macintosh HD");
    main.update(&model, tree.msgForPointer(computer.id, .up).?);
    try testing.expectEqualStrings("/", model.currentPath());

    const hidden_before = model.show_hidden;
    main.update(&model, .toggle_hidden);
    try testing.expect(model.show_hidden != hidden_before);

    tree = try buildTree(arena, &model);
    _ = try expectByText(tree.root, .list_item, "Home");
    _ = try expectByText(tree.root, .data_cell, "Name");
}

test "the view lays out through the canvas engine" {
    var arena_state = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena_state.deinit();

    var threaded = std.Io.Threaded.init(testing.allocator, .{});
    defer threaded.deinit();
    var model = main.initialModel(threaded.io());
    const tree = try buildTree(arena_state.allocator(), &model);

    var nodes: [1024]canvas.WidgetLayoutNode = undefined;
    const layout = try canvas.layoutWidgetTree(tree.root, native_sdk.geometry.RectF.init(0, 0, 1120, 760), &nodes);
    try testing.expect(layout.nodes.len > 0);

    const home = try expectByText(tree.root, .list_item, "Home");
    var saw_button = false;
    for (layout.nodes) |node| {
        if (node.widget.id == home.id) saw_button = true;
    }
    try testing.expect(saw_button);
}

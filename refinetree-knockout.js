ko.bindingHandlers.refineTree = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        var options = allBindingsAccessor().refineTreeOptions;

        $(element).refinetree({ eventOnApiChange: false })
            .refinetree('tree', ko.utils.unwrapObservable(options))
            .change(function(ev, ids) {
                valueAccessor()(ids);
            });

        if (ko.isObservable(options)) options.subscribe(function(opts) {
            $(element).refinetree('tree', opts);
        });
    },
    update: function(element, valueAccessor, allBindingsAccessor) {
        $(element).refinetree('selected', ko.utils.unwrapObservable(valueAccessor()));
    }
}

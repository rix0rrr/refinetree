ko.bindingHandlers.refineTree = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        var options = allBindingsAccessor().refineTreeOptions;
        var settings = allBindingsAccessor().refineTreeSettings;
        
        var allSettings = { eventOnApiChange: false };
        if (typeof settings === 'object') {
          $.extend(allSettings, settings);
        }

        var optsVal = ko.utils.unwrapObservable(options);
        $(element).refinetree(allSettings)
            .refinetree('tree', optsVal ? optsVal : [])
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
};
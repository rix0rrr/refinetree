RefineTree
==========

RefineTree is a hierarchical JavaScript filter that allows drilldown. It will display the selected items in a tree intelligently.

![Screenshot of RefineTree](https://hub.sioux.eu/p/refinetree/source/tree/master/screenshot.png)

RefineTree Depends on jQuery and Bootstrap.


Usage
-----

Examples (note, you shouldn't actually use the following, cache the
jQuery result in a variable ;)

    $(function() {
        // Initialize
        $('.my-tree').refinetree();

        // Listening to changes
        $('.my-tree').change(function(ev, selected) {
            alert(JSON.stringify(selected));
        });


        // Calling an API function
        var result = $('.my-tree').refinetree('function', arguments, ...);
    });


### API:


    Function                    Description
    --------                    -------------
    show, hide, toggle          Control the visibility of the tree.
    visible                     Return whether the tree is currently visible.
    selected( [items] )         Return or set the IDs of all effectively selected
                                items (that means CHECKED without any of its
                                children checked).
    tree( [items] )             Return or set the items of the complete tree
                                (see Elements section).
    summarize                   Return some HTML that describes the selected
                                nodes (for human consumption)

Selected and tree can be called in either order (i.e., you can set the selected
IDs before setting the tree, and the elements will be checked as soon as the
tree is loaded). When selected() is read, it will NOT return items that are not
in the tree.

Additional options that can be passed to the constructor:
    
    $('.tree').refinetree({

        placeholder: 'Placeholder text',

        // Function used to summarize objects for human consumption
        summarize: function(ids, objects, options) { ... },

        maxHeight: 300,

        id: 'idfieldname',

        text: 'textfieldname',

        maxItemsInCaption: 10,

        // Whether to trigger a change event when the change was via an
        // API call instead of a user action.
        eventOnApiChange: true 
    });


### Elements

RefineTree expects a hierarchical list of objects with an `id`, `text` and `children` property. `id` is used to identify items, `text` is the display text,
and `children` is an array of more of these objects.


KnockoutJS
----------

RefineTree includes bindings for KnockoutJS. If you use that, it's even easier to use.

Simply include this AFTER including KnockoutJS:

    <script src="refinetree/refinetree-knockout.js">

Then you can simply bind to your view with this:

    <div class="..." data-bind="refinetree: myoptions, selected: curoption"></div>
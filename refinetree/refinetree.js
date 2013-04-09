/**
 * jQuery plugin to let people refine a hierarchical multiselection
 *
 * The entire data set must currently be available at once.
 *
 * Note that the concepts "selected" and "checked" are different in this
 * control. An item is SELECTED if it is CHECKED and none of its children are
 * checked (i.e., no further refinement). Visually, however, the children will
 * be indicated as selected if none of their siblings are checked, to indicate
 * that they are all included in the selection.
 */
(function($) {
    /**
     * A set of (stringifiable) items
     */
    function Set(initial) {
        var self  = this;
        var items = {};

        if (initial) {
            for (var i in initial) if (initial.hasOwnProperty(i)) items[initial[i]] = true;
        }

        self.add = function(item) {
            items[item] = true;
        }

        self.remove = function(item) {
            delete items[item];
        }

        self.has = function(item) {
            return items[item] || false;
        }

        self.asArray = function() {
            var r = [];
            for (var i in items) if (items.hasOwnProperty(i)) r.push(i);
            return r;
        }
    }

    var escapeHTML = (function () {
        var chr = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' };
        return function (text) {
            return ('' + text).replace(/[\"&<>]/g, function (a) { return chr[a]; });
        };
    }());

    /**
     * Return whether the predicate holds for at least one element in the list
     */
    function any(list, predicate) {
        var result = false;
        $.each(list, function(i, x) {
            if (predicate(x)) {
                result = true;
                return false; // Stop
            }
        });
        return result;
    }

    /**
     * Return the captions of the given set of objects
     */
    function captions(objs, options) {
        return $.map(objs, function(obj) {
            return obj[options.text];
        }).join(', ');
    }

    /**
     * Default summarization function
     */
    function defaultSummarizer(ids, objects, options) {
        var visible = objects.slice(0, options.maxItemsInCaption);
        var rest    = objects.slice(options.maxItemsInCaption);

        return '<span title="' + captions(objects, options) + '">' + 
            $.map(visible, function(obj) {
                return '<span class="refinetree-mention">' + escapeHTML(obj[options.text]) + '</span>';
            }).join(' ')  +
            (rest.length ? ' and ' + rest.length + ' more...' : '') +
            '</span>';
    }


    /**
     * Private API 
     */
    function RefineTree(root, settings) {
        var self = this;

        var checked     = [];        // Holds the currently checked objects from the collection
        var checkedIds  = new Set(); // Holds the "in principle" checked ids, may be set before there are items in the collection
        var tree        = [];        // Holds the tree's object graph. Should be a list of objects which have a 'children' attribute which is also a list of objects, and so on.

        var idToElement  = {};       // Lookup map from node ID -> element
        var idClassCache = {};       // Cache of styles for every node ID, so we don't have to go to the DOM every time (in case there is no change)
        var idToParent   = {};       // Lookup map from node ID -> parent node

        var options = $.extend({
            placeholder: 'Click to select items',
            summarize: defaultSummarizer,
            maxHeight: 300,
            id: 'id',
            text: 'text',
            maxItemsInCaption: 5,
            eventOnApiChange: true,
        }, settings);

        // Create the popup
        var popup = $('<div class="refinetree-popup"></div>')
            .css({
                display:  'none',
                position: 'absolute'
            })
            .appendTo(document.body);

        // Style the current object
        root.css({
                cursor: 'pointer'
            })
            .addClass('refinetree-field')
            .click(function(ev) {
                self.toggle();
            });

        // Hide the popup by clicking anywhere outside it
        $('html').click(function(ev) { if(!root.is(ev.target)) self.hide(); });
        popup.click(function(ev) { ev.stopPropagation(); });

        // Resize of the window should reposition the popup
        $(window).resize(function() { if (self.visible()) self.show(); });


        /**
         * Whether the popup is currently visible
         */
        self.visible = function() {
            return popup.css('display') == 'block';
        };

        /**
         * Toggle the visibility of the popup
         */
        self.toggle = function() {
            self[self.visible() ? 'hide' : 'show']();
        };

        /**
         * Show or reposition the popup
         */
        self.show = function() {
            var offset    = root.offset();
            var wasHidden = !self.visible();

            root.addClass('open');
            popup.css({
                left      : offset.left,
                top       : offset.top + root.outerHeight(),
                width     : root.width() + 10,
                maxHeight : options.maxHeight,
                display   : 'block'
            });

            if (wasHidden) {
                // Scroll first selected item into view
                setTimeout(function() {
                    var ofs = popup.find('input:checked:first').position();
                    if (ofs && popup.scrollTop() == 0) popup.scrollTop(ofs.top + popup.scrollTop() - 30); // With a bit of margin
                }, 0);
                root.trigger('shown');
            }
        };

        /**
         * Hide the popup
         */
        self.hide = function() {
            root.removeClass('open');

            var wasVisible = self.visible();
            popup.css('display', 'none');

            if (wasVisible) root.trigger('hidden');
        };

        /**
         * Return an HTML summarization of the selected options, by calling the summarized function
         */
        self.summarize = function() {
            var sel  = self.selected();

            if (sel.length) {
                var flat = allOptions();
                return options.summarize(sel, $.map(sel, function(id) { return find(flat, id); }), options);
            }
            else
                return '<span class="refinetree-placeholder">' + escapeHTML(options.placeholder) + '</span>';
        };

        /**
         * Return the ids of all items that are selected (checked without having children checked)
         */
        self.selected = function(content) { 
            var flatTree = allOptions();

            if (typeof(content) === 'undefined') {
                var sel = $.grep(flatTree, function(option) {
                    return nodeChecked(option) && !childrenChecked(option);
                });

                return $.map(sel, idOf);
            } else {
                // Copy the checked ids
                checkedIds = new Set(content);

                // Subset the ids to objects that are actually in the collection
                var newChecked = [];        

                $.each(content, function(i, id) {
                    // Find the node with this id
                    var n = find(flatTree, id);
                    // Check the node and every of its parents
                    $.each(rootPath(n), function(i, node) {
                        if ($.inArray(node, newChecked) == -1) {
                            newChecked.push(node);
                            checkedIds.add(idOf(node));
                        }
                    });
                });

                checked = newChecked;
                updateChecked(tree);
                updateSummary();
                updateElementClasses(tree);
                if (options.eventOnApiChange) triggerChange();
            }
        };

        /**
         * Return or set the option tree
         */
        self.tree = function(content) {
            if (typeof(content) === 'undefined')
                return tree;
            else {
                tree = content;
                idToParent = {};
                recordParents(null, tree);

                // (Re)create the HTML for all options
                idToElement  = {};
                idClassCache = {};
                popup.empty();
                createElements(popup, tree);

                // Re-apply theoretical selection
                self.selected(checkedIds.asArray());
            }
        };

        /**
         * Record the parent node for every node
         */
        function recordParents(parent, children) {
            $.each(children, function(i, child) {
                var childId = idOf(child);
                if (childId in idToParent)
                    throw new Error("The following element ID occurs multiple times: " + childId);

                idToParent[childId] = parent;

                if (!child.children) child.children = [];
                recordParents(child, child.children);
            });
        }

        /**
         * Trigger a jQuery 'change' event on the element
         */
        function triggerChange() {
            root.trigger('change', [self.selected()]);
        }

        /**
         * Return the id of the option
         */
        function idOf(opt) {
            return opt[options.id];
        }

        /**
         * Return the text of the option
         */
        function textOf(opt) {
            return opt[options.text];
        }

        /**
         * An element is selected if it is checked, or its direct parent is checked
         * and none of that parent's children are checked.
         */
        function nodeSelected(option) {
            if (nodeChecked(option)) return true;

            var parent = findParent(option);
            if (!parent) return false;

            return nodeChecked(parent) && !childrenChecked(parent);
        }

        /**
         * Return whether any of this option's children are checked
         */
        function childrenChecked(option) {
            return any(option.children, function(child) {
                return nodeChecked(child);
            });
        }

        /**
         * Return whether the given option is in the checked list
         */
        function nodeChecked(option) {
            return checkedIds.has(idOf(option));
        }

        /**
         * Find node by ID.
         *
         * We don't need to do this often so not using a precalculated cache.
         */
        function findNode(id) {
            function recurse(nodes) {
                var found;
                $.each(nodes, function(i, node) {
                    if (id == idOf(node)) {
                        found = node;
                        return false; // Stop
                    }
                    if (node.children) found = recurse(node.children);
                    if (found) return false; // Stop
                });
                return found;
            }
            return recurse(tree);
        }

        /**
         * Find the option's parent in the given forest of parents
         */
        function findParent(option) {
            return idToParent[idOf(option)];
        }

        function setNodeClass(id, klass) {
            if (idClassCache[id] == klass) return; // No change

            idClassCache[id] = klass;
            idToElement[id].attr('class', 'element ' + klass);
        }

        /**
         * Add or remove the 'selected' class on each element according to whether it is selected
         */
        function updateElementClasses(nodes) {
            $.each(nodes, function(i, node) {
                var id = idOf(node);

                var klass = '';
                if (nodeChecked(node)) klass = 'expanded';

                if (childrenChecked(node))   klass += ' child-selected';
                else if (nodeSelected(node)) klass += ' selected';

                setNodeClass(id, klass);

                if (node.children) updateElementClasses(node.children);
            });
        }

        /**
         * Bring all checkboxes in line with the current selection state of the model
         */
        function updateChecked(nodes) {
            $.each(nodes, function(i, node) {
                idToElement[idOf(node)].find('input:first').attr('checked', nodeChecked(node));

                if (node.children) updateChecked(node.children);
            });
        }

        /**
         * Set the checked status for a given element
         */
        function recordCheck(node, state) {
            if (state) {
                checked.push(node);
                checkedIds.add(idOf(node));
            } else {
                var ix = $.inArray(node, checked);
                if (ix >= 0) checked.splice(ix, 1);

                checkedIds.remove(idOf(node));
            }
        }

        function checkRecursive(nodes, state) {
            $.each(nodes, function(i, node) {
                recordCheck(node, state);

                if (node.children) checkRecursive(node.children, state);
            });
        }

        /**
         * Create the HTML structure for the tree
         *
         * Ideally, I would like to use DOM manipulation but it's too slow for the large dataset.
         * So we build up HTML, add it as one chunk, and attach the event handler later on.
         */
        function createElements(div, nodes) {
            var fragments = [];

            function recurse(nodes) {
                $.each(nodes, function(i, node) {
                    fragments.push('<div class="element" data-refinetree-id="' + escapeHTML(idOf(node)) + '"><label><input type="checkbox">' + escapeHTML(textOf(node)) + '</label><div class="children">');
                    if (node.children) recurse(node.children);
                    fragments.push('</div></div>');
                });
            }
            recurse(nodes);

            // Set DIV content and attach one event handler for all checkboxes
            div.html(fragments.join(''))
                .change(function(ev) {
                    var box = $(ev.target);

                    // One event handler for all checkboxes
                    var id   = box.closest('.element').data('refinetree-id');
                    if (!id) return;
                    var node = findNode(id);

                    recordCheck(node, box.is(':checked'));

                    if (!$(this).is(':checked')) {
                        // If unchecked, also remove all checks from children
                        checkRecursive(node.children, false);
                        updateChecked(node.children);
                    }

                    // Only change styles on the possibly affected subtree
                    var dirtyNodes = [findParent(node) || node];
                    updateElementClasses(dirtyNodes);
                    updateSummary();
                    triggerChange();

                    self.show(); // Do this to be safe, because the div may get taller or shorter and we may need to reposition
                });

            // Find and record every div.element in the map for fast class setting
            div.find('.element').each(function(i, el) {
                var $el = $(el);
                idToElement[$el.data('refinetree-id')] = $el;
            });
        }

        /**
         * Update the summary in the root element
         */
        function updateSummary() {
            return root.html(self.summarize());
        }

        /**
         * Return all options in a flat list instead of a tree structure
         */
        function allOptions() {
            var ret = [];

            function recurse(options) {
                $.each(options, function(i, option) {
                    ret.push(option);
                    recurse(option.children);
                });
            }
            recurse(tree);

            return ret;
        }

        /**
         * Find a node in the list by ID
         */
        function find(list, id) {
            var found;
            $.each(list, function(i, option) {
                if (idOf(option) == id) {
                    found = option;
                    return false; // Stop
                }
            });
            return found;
        }

        function rootPath(node) {
            var ret = [];
            while (node) {
                ret.push(node);
                node = findParent(node);
            }
            return ret;
        }

        updateSummary();
    }

    /**
     * Dispatcher
     */
    $.fn.refinetree = function(method) {
        if (typeof method === 'object' || !method) {
            if (this.data('refinetree')) return; // Already initialized
            this.data('refinetree', new RefineTree(this, method));
            return this;
        }

        var tree = this.data('refinetree');
        if (tree[method]) {
            tree[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else {
            $.error('Method ' +  method + ' does not exist on jQuery.refinetree');
        }
        return this;
    }
}(jQuery));

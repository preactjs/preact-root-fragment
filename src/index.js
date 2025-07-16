/**
 * A Preact 11+ implementation of the `replaceNode` parameter from Preact 10.
 *
 * This creates a "Persistent Fragment" (a fake DOM element) containing one or more
 * DOM nodes, which can then be passed as the `parent` argument to Preact's `render()` method.
 *
 * @param {import('preact').ContainerNode} parent
 * @param {import('preact').ContainerNode | import('preact').ContainerNode[]} replaceNode
 * @returns {import('preact').ContainerNode}
 */
export function createRootFragment(parent, replaceNode) {
    replaceNode = [].concat(replaceNode);
    var s = replaceNode[replaceNode.length - 1].nextSibling;

    /**
     * @param {import('preact').ContainerNode} c
     * @param {import('preact').ContainerNode | null} [r]
     * @returns {import('preact').ContainerNode}
     */
    function insert(c, r) {
        return parent.insertBefore(c, r || s);
    }

    return (parent.__k = {
        nodeType: 1,
        parentNode: parent,
        firstChild: replaceNode[0],
        childNodes: replaceNode,
        insertBefore: insert,
        appendChild: insert,
        removeChild: function (c) {
            return parent.removeChild(c);
        },
        contains: function (c) {
            return parent.contains(c);
        },
    });
}

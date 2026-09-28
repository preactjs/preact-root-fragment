import { h, render, hydrate, Fragment, Component } from 'preact';
import { useState } from 'preact/hooks';
import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createRootFragment } from '../src/index.js';
import { sortAttributes, serializeHtml } from './utils.js';

const expect = chai.expect;
chai.use(sinonChai);

describe('createRootFragment', () => {
    let scratch;

    /**
     * @param {HTMLDivElement} container
     * @returns {HTMLDivElement[]}
     */
    function setupABCDom(container) {
        return ['a', 'b', 'c'].map(id => {
            const child = document.createElement('div');
            child.id = id;
            container.appendChild(child);

            return child;
        });
    }

    beforeEach(() => {
        if (scratch) {
            render(null, scratch);
            scratch.remove();
        }
        scratch = document.createElement('scratch');
        document.body.appendChild(scratch);
        history.replaceState(null, null, '/');
    });

    it('should use replaceNode as render root and not inject into it', () => {
        setupABCDom(scratch);
        const childA = scratch.querySelector('#a');

        render(<div id="a">contents</div>, createRootFragment(scratch, childA));
        expect(scratch.querySelector('#a')).to.equal(childA);
        expect(childA.innerHTML).to.equal('contents');
    });

    it('should not remove siblings of replaceNode', () => {
        setupABCDom(scratch);
        const childA = scratch.querySelector('#a');

        render(<div id="a" />, createRootFragment(scratch, childA));
        expect(scratch.innerHTML).to.equal(
            '<div id="a"></div><div id="b"></div><div id="c"></div>'
        );
    });

    it('should notice prop changes on replaceNode', () => {
        setupABCDom(scratch);
        const childA = scratch.querySelector('#a');

        render(<div id="a" className="b" />, createRootFragment(scratch, childA));
        expect(sortAttributes(String(scratch.innerHTML))).to.equal(
            sortAttributes(
                '<div id="a" class="b"></div><div id="b"></div><div id="c"></div>'
            )
        );
    });

    it('should unmount existing components', () => {
        const unmount = sinon.spy();
        const mount = sinon.spy();
        class App extends Component {
            componentDidMount() {
                mount();
            }

            componentWillUnmount() {
                unmount();
            }

            render() {
                return <div>App</div>;
            }
        }

        render(
            <div id="a">
                <App />
            </div>,
            scratch
        );
        expect(scratch.innerHTML).to.equal('<div id="a"><div>App</div></div>');
        expect(mount).to.be.calledOnce;

        render(
            <div id="a">new</div>,
            createRootFragment(scratch, scratch.querySelector('#a'))
        );
        expect(scratch.innerHTML).to.equal('<div id="a">new</div>');
        //expect(unmount).to.be.calledOnce;
    });

    it('should unmount existing components in prerendered HTML', () => {
        const unmount = sinon.spy();
        const mount = sinon.spy();
        class App extends Component {
            componentDidMount() {
                mount();
            }

            componentWillUnmount() {
                unmount();
            }

            render() {
                return <span>App</span>;
            }
        }

        scratch.innerHTML = `<div id="child"></div>`;

        const childContainer = scratch.querySelector('#child');

        render(<App />, childContainer);
        expect(serializeHtml(childContainer)).to.equal('<span>App</span>');
        expect(mount).to.be.calledOnce;

        render(<div />, createRootFragment(scratch, scratch.firstElementChild));
        expect(serializeHtml(scratch)).to.equal('<div id=""></div>');
        //expect(unmount).to.be.calledOnce;
    });

    it('should render multiple render roots in one parentDom', () => {
        setupABCDom(scratch);
        const childA = scratch.querySelector('#a');
        const childB = scratch.querySelector('#b');
        const childC = scratch.querySelector('#c');

        const expectedA = '<div id="a">childA</div>';
        const expectedB = '<div id="b">childB</div>';
        const expectedC = '<div id="c">childC</div>';

        render(<div id="a">childA</div>, createRootFragment(scratch, childA));
        render(<div id="b">childB</div>, createRootFragment(scratch, childB));
        render(<div id="c">childC</div>, createRootFragment(scratch, childC));

        expect(scratch.innerHTML).to.equal(`${expectedA}${expectedB}${expectedC}`);
    });

    it('should call unmount when working with replaceNode', () => {
        const mountSpy = sinon.spy();
        const unmountSpy = sinon.spy();
        class MyComponent extends Component {
            componentDidMount() {
                mountSpy();
            }
            componentWillUnmount() {
                unmountSpy();
            }
            render() {
                return <div>My Component</div>;
            }
        }

        const container = document.createElement('div');
        scratch.appendChild(container);

        render(<MyComponent />, createRootFragment(scratch, container));
        expect(mountSpy).to.be.calledOnce;

        render(<div>Not my component</div>, createRootFragment(document.body, container));
        //expect(unmountSpy).to.be.calledOnce;
    });

    it('should double replace', () => {
        const container = document.createElement('div');
        scratch.appendChild(container);

        render(<div>Hello</div>, createRootFragment(scratch, scratch.firstElementChild));
        expect(scratch.innerHTML).to.equal('<div>Hello</div>');

        render(<div>Hello</div>, createRootFragment(scratch, scratch.firstElementChild));
        expect(scratch.innerHTML).to.equal('<div>Hello</div>');
    });

    it('should replaceNode after rendering', () => {
        function App({ i }) {
            return <p>{i}</p>;
        }

        render(<App i={2} />, scratch);
        expect(scratch.innerHTML).to.equal('<p>2</p>');

        render(<App i={3} />, createRootFragment(scratch, scratch.firstChild));
        expect(scratch.innerHTML).to.equal('<p>3</p>');
    });

    it("shouldn't remove elements on subsequent renders with replaceNode", () => {
        const placeholder = document.createElement('div');
        scratch.appendChild(placeholder);
        const App = () => (
            <div>
                New content
                <button>Update</button>
            </div>
        );

        render(<App />, createRootFragment(scratch, placeholder));
        expect(scratch.innerHTML).to.equal(
            '<div>New content<button>Update</button></div>'
        );

        render(<App />, createRootFragment(scratch, placeholder));
        expect(scratch.innerHTML).to.equal(
            '<div>New content<button>Update</button></div>'
        );
    });

    it('should remove redundant elements on subsequent renders with replaceNode', () => {
        const placeholder = document.createElement('div');
        scratch.appendChild(placeholder);
        const App = () => (
            <div>
                New content
                <button>Update</button>
            </div>
        );

        render(<App />, createRootFragment(scratch, placeholder));
        expect(scratch.innerHTML).to.equal(
            '<div>New content<button>Update</button></div>'
        );

        placeholder.appendChild(document.createElement('span'));
        expect(scratch.innerHTML).to.equal(
            '<div>New content<button>Update</button><span></span></div>'
        );

        render(<App />, createRootFragment(scratch, placeholder));
        expect(scratch.innerHTML).to.equal(
            '<div>New content<button>Update</button></div>'
        );
    });

    describe('siblings outside the fragment', () => {
        const List = ({ items }) => items.map(i => <li key={i}>{i}</li>);
        const listHtml = items =>
            '<li id="before"></li>' +
            items.map(i => `<li>${i}</li>`).join('') +
            '<li id="after"></li>';

        /** @returns {{ root: import('preact').ContainerNode, items: Element[] }} */
        function setupList(items) {
            scratch.innerHTML = listHtml(items);
            const children = [].slice.call(scratch.children, 1, -1);
            return { root: createRootFragment(scratch, children), items: children };
        }

        it('should not re-insert the replaced nodes on initial render', () => {
            const { root, items } = setupList([1, 2]);
            const observer = new MutationObserver(() => {});
            observer.observe(scratch, { childList: true });

            render(<List items={[1, 2]} />, root);

            expect(observer.takeRecords()).to.have.length(0);
            observer.disconnect();
            expect(scratch.children[1]).to.equal(items[0]);
            expect(scratch.children[2]).to.equal(items[1]);
        });

        it('should insert new children at the right position', () => {
            const { root } = setupList([1, 2]);

            render(<List items={[1, 2]} />, root);
            render(<List items={[0, 1, 2]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([0, 1, 2]));

            render(<List items={[0, 1, 3, 2]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([0, 1, 3, 2]));

            render(<List items={[0, 1, 3, 2, 4]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([0, 1, 3, 2, 4]));

            render(<List items={[1, 2]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([1, 2]));
        });

        it('should reorder keyed children', () => {
            const { root } = setupList([1, 2, 3]);

            render(<List items={[1, 2, 3]} />, root);
            // Preact 11 moves nodes with moveBefore() where the browser supports it
            render(<List items={[3, 1, 2]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([3, 1, 2]));

            render(<List items={[2, 3, 1]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([2, 3, 1]));

            render(<List items={[1, 2, 3]} />, root);
            expect(scratch.innerHTML).to.equal(listHtml([1, 2, 3]));
        });

        it('should keep state of moved children where moveBefore() is supported', () => {
            const { root } = setupList([1, 2, 3]);
            const Inputs = ({ items }) =>
                items.map(i => (
                    <li key={i}>
                        <input id={'i' + i} />
                    </li>
                ));

            render(<Inputs items={[1, 2, 3]} />, root);
            const input = scratch.querySelector('#i3');
            input.focus();
            const moveBefore = sinon.spy(root, 'moveBefore');

            render(<Inputs items={[3, 1, 2]} />, root);
            expect(scratch.children[1].firstChild).to.equal(input);
            // Preact 10 has no moveBefore() support, only check when it is used
            if (moveBefore.called && 'moveBefore' in Element.prototype) {
                expect(document.activeElement).to.equal(input);
            }
            moveBefore.restore();
        });

        it('should add children before existing ones on state updates', async () => {
            const { root } = setupList([1]);
            let setItems;
            function App() {
                const [items, set] = useState([1]);
                setItems = set;
                return <List items={items} />;
            }

            render(<App />, root);
            setItems([0, 1]);
            await new Promise(r => setTimeout(r, 0));
            expect(scratch.innerHTML).to.equal(listHtml([0, 1]));

            setItems([1, 0]);
            await new Promise(r => setTimeout(r, 0));
            expect(scratch.innerHTML).to.equal(listHtml([1, 0]));
        });

        it('should hydrate without touching the DOM', async () => {
            scratch.innerHTML = '<p id="a"></p><button>0</button><p id="c"></p>';
            const button = scratch.children[1];
            function Counter() {
                const [count, setCount] = useState(0);
                return <button onClick={() => setCount(count + 1)}>{count}</button>;
            }

            const observer = new MutationObserver(() => {});
            observer.observe(scratch, { childList: true, subtree: true, characterData: true });
            hydrate(<Counter />, createRootFragment(scratch, button));
            expect(observer.takeRecords()).to.have.length(0);
            observer.disconnect();

            button.click();
            await new Promise(r => setTimeout(r, 0));
            expect(scratch.innerHTML).to.equal('<p id="a"></p><button>1</button><p id="c"></p>');
            expect(scratch.children[1]).to.equal(button);
        });

        it('should render independent fragments into one parent', () => {
            setupABCDom(scratch);
            const a = createRootFragment(scratch, scratch.querySelector('#a'));
            const b = createRootFragment(scratch, scratch.querySelector('#b'));

            render(<div id="a">A</div>, a);
            render(<div id="b">B</div>, b);
            render(
                <>
                    <p>A0</p>
                    <div id="a">A</div>
                    <p>A2</p>
                </>,
                a
            );
            render(
                <>
                    <p>B0</p>
                    <div id="b">B</div>
                </>,
                b
            );
            expect(scratch.innerHTML).to.equal(
                '<p>A0</p><div id="a">A</div><p>A2</p><p>B0</p><div id="b">B</div><div id="c"></div>'
            );
        });
    });

    it('should create children in the namespace of the parent', () => {
        scratch.innerHTML = '<svg><rect></rect><g></g><rect></rect></svg>';
        const svg = scratch.firstChild;
        const root = createRootFragment(svg, svg.children[1]);

        render(
            <g>
                <circle r="1" />
            </g>,
            root
        );
        expect(svg.querySelector('circle').namespaceURI).to.equal(
            'http://www.w3.org/2000/svg'
        );

        render(<circle r="2" />, root);
        expect(svg.children[1].localName).to.equal('circle');
        expect(svg.children[1].namespaceURI).to.equal('http://www.w3.org/2000/svg');
    });
});

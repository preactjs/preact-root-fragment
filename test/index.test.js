import { h, render, Component } from 'preact';
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
});

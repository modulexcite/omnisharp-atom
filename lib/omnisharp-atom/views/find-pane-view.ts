import _ = require('lodash')
import Omni = require('../../omni-sharp-server/omni')
import React = require('react');
import {ReactClientComponent} from "./react-client-component";

class FindPaneWindow extends ReactClientComponent<{}, { usages?: OmniSharp.Models.QuickFix[] }> {
    public displayName = 'FindPaneWindow';

    constructor(props?: {}, context?: any) {
        super({ trackClientChanges: true }, props, context);
        this.state = { usages: [] };
    }

    public componentDidMount() {
        super.componentDidMount();

        this.disposable.add(Omni.listen.observeFindusages.subscribe((data) => {
            this.setState({
                usages: data.response.QuickFixes
            });
        }));

        this.disposable.add(Omni.listen.observeFindimplementations.subscribe((data) => {
            if (data.response.QuickFixes.length > 1) {
                this.setState({
                    usages: data.response.QuickFixes
                });
            }
        }));
    }

    private gotoUsage(quickfix: OmniSharp.Models.QuickFix) {
        Omni.navigateTo(quickfix);
    }

    public render() {
        if (!this.client || this.client.isOff) {
            return React.DOM.ul({
                className: 'background-message centered'
            }, React.DOM.li({},
                React.DOM.span({}, 'Omnisharp server is turned off'),
                React.DOM.kbd({
                    className: 'key-binding text-highlight'
                }, '⌃⌥O')
                ));
        }

        if (this.client && this.client.isConnecting) {
            return React.DOM.ul({
                className: 'background-message centered'
            }, React.DOM.li({}, React.DOM.progress({
                className: 'inline-block'
            })));
        }

        return React.DOM.table({
            className: 'error-table',
        }, React.DOM.thead({},
            React.DOM.th({}, 'line'),
            React.DOM.th({}, 'column'),
            React.DOM.th({}, 'column'),
            React.DOM.th({}, 'filename')
            ), React.DOM.tbody({},
                ..._.map(this.state.usages, (usage: OmniSharp.Models.QuickFix) =>
                    React.DOM.tr({
                        onClick: (e) => this.gotoUsage(usage)
                    },
                        React.DOM.td({}, usage.Line),
                        React.DOM.td({}, usage.Column),
                        React.DOM.td({}, usage.Text),
                        React.DOM.td({}, usage.FileName)
                        ))
                ));
    }
}

export = function() {
    var element = document.createElement('div');
    element.className = 'error-output-pane';
    React.render(React.createElement(FindPaneWindow, null), element);
    return element;
}

import {helpers, Observable} from 'rx';
import manager = require("./client-manager");
import Client = require("./client");
//import {DriverState} from "omnisharp-client";
import _ = require('lodash');
import ko = require('knockout');

interface IGlobalState {
    projects: KnockoutObservableArray<IOmniSharpProject>;
    activeProject: KnockoutObservable<IOmniSharpProject>;
}
interface IOmniSharpProject {
    atomProjectPath: string; //won't change.
    //for now we just pass the array as a whole to react but we could change this to
    //observableerrors when we receive update over stdio and need to dedup
    errorsAndWarnings: KnockoutObservable<OmniSharp.Models.DiagnosticLocation[]>;
    client: Client;
}

class OmniSharp implements IGlobalState {

    public projects: KnockoutObservableArray<IOmniSharpProject>;
    public activeProject: KnockoutObservable<IOmniSharpProject>;

    constructor()
    {
        this.projects = ko.observableArray<IOmniSharpProject>();
        this.activeProject = ko.observable<IOmniSharpProject>()
    }

    public tryClientCall<T>(call: (client: Client) => Rx.Observable<T>) : Rx.Observable<T> {
        var project = this.activeProject();
        if (!project || !project.client || !project.client.isOn)
            return Rx.Observable.empty<T>();

        return call(project.client);
    }

    public setActiveProject(atomProjectPath: string) {
        var project = _.first(_.filter(this.projects(), p => p.atomProjectPath == atomProjectPath));
        if (!project) return;
        this.activeProject(project);
    }

    public registerProject(atomProjectPath: string) : void
    {
        //noop if we already registered this atomProject
        if (_.any(this.projects(), p => p.atomProjectPath == atomProjectPath)) return;
        this.projects.push(new OmniSharpProject(atomProjectPath));
        this.setActiveProject(atomProjectPath);
    }

    public removeProject(atomProjectPath: string) {
        var project = _.first(_.filter(this.projects(), p => p.atomProjectPath == atomProjectPath));
        if (!project) return;

        //makeSure we disconnect before removing
        if (project.client) project.client.disconnect()
        this.projects.remove(project);
        if (this.activeProject().atomProjectPath == atomProjectPath)
        {
            //either null or the last added project ?
        }
    }
}

class OmniSharpProject implements IOmniSharpProject {
    public atomProjectPath: string;
    public errorsAndWarnings: KnockoutObservable<OmniSharp.Models.DiagnosticLocation[]>;
    public client: Client;
    public sourceProjects: KnockoutObservableArray<string>;

    constructor(atomProjectPath: string)
    {
        this.atomProjectPath = atomProjectPath;
        this.errorsAndWarnings = ko.observable<OmniSharp.Models.DiagnosticLocation[]>();
        this.sourceProjects = ko.observableArray(this.findOmniSharpProjectsInAtomProject());
        //here we can validate if we find runnable solutions/projects/folders?

        var projectPath = _.first(this.sourceProjects());

        //TODO figure out what these two paths are :)
        this.client = new Client(projectPath, {
            projectPath: projectPath
        });

        //setup client subscriptions for this project we like to share, (e.g)
    }

    public findOmniSharpProjectsInAtomProject() : string[]
    {
        //imagine this works :)
        return [""];
    }
}


class Omni {

    public static VM = new OmniSharp();

    public static toggle() {
        if (manager.connected) {
            manager.disconnect();
        } else {
            manager.connect();
        }
    }

    public static get isOff() { return manager.isOff; }
    public static get isOn() { return manager.isOn; }

    public static navigateTo(response: { FileName: string; Line: number; Column: number; }) {
        atom.workspace.open(response.FileName, undefined)
            .then((editor) => {
                editor.setCursorBufferPosition([response.Line && response.Line - 1, response.Column && response.Column - 1])
            });
    }

    public static getFrameworks(projects: string[]): string {
        var frameworks = _.map(projects, (project: string) => {
            return project.indexOf('+') === -1 ? '' : project.split('+')[1];
        }).filter((fw: string) => fw.length > 0);
        return frameworks.join(',');
    }

    public static get listen() {
        return manager.aggregateClient;
    }

    private static _client: Client;
    public static request<T>(editor: Atom.TextEditor, callback: (client: OmniSharp.ExtendApi) => Rx.Observable<T> | Rx.IPromise<T>);
    public static request<T>(callback: (client: OmniSharp.ExtendApi) => Rx.Observable<T> | Rx.IPromise<T>);
    public static request<T>(editor: Atom.TextEditor | ((client: OmniSharp.ExtendApi) => Rx.Observable<T> | Rx.IPromise<T>), callback?: (client: OmniSharp.ExtendApi) => Rx.Observable<T> | Rx.IPromise<T>) {
        if (_.isFunction(editor)) {
            callback = <any>editor;
            editor = null;
        }

        var clientCallback = (client: Client) => {
            var r = callback(client);
            if (helpers.isPromise(r)) {
                return Observable.fromPromise(<Rx.IPromise<T>> r);
            } else {
                return <Rx.Observable<T>>r;
            }
        };

        var result: Observable<T>;

        if (editor) {
            result = manager.getClientForEditor(<Atom.TextEditor> editor).flatMap(clientCallback)
        } else {
            result = manager.activeClient.first().flatMap(clientCallback);
        }

        // Ensure that the underying promise is connected
        //   (if we don't subscribe to the reuslt of the request, which is not a requirement).
        var sub = result.subscribe(() => sub.dispose());

        return result;
    }

    public static get activeClient() {
        return manager.activeClient;
    }

    public static get state() {
        return manager.state;
    }

    public static registerConfiguration(callback: (client: Client) => void) {
        manager.registerConfiguration(callback);
    }
}

export = Omni

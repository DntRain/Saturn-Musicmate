"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplorerStore = void 0;
class ExplorerStore {
    state;
    listeners = new Set();
    constructor(initialState) {
        this.state = initialState;
    }
    getState() {
        return this.state;
    }
    setState(nextState) {
        this.state = nextState;
        this.emit();
    }
    updateState(updater) {
        this.setState(updater(this.state));
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    emit() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
exports.ExplorerStore = ExplorerStore;

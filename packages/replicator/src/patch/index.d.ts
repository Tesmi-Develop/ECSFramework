interface Patch {
	diff: <T>(prevState: T, nextState: T, excludeProperties?: Set<string>) => T;
	apply: <T>(state: T, patches: T) => T;
}

declare const patch: Patch;
export = patch;

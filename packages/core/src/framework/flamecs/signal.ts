export interface Signal<T extends Array<unknown>> {
	connect(func: (...args: T) => void): () => void;
	fire(...args: T): void;
}

export function createSignal<T extends Array<unknown>>(): Signal<T> {
	const listeners: Array<(...args: T) => void> = [];

	return {
		connect(func: (...args: T) => void) {
			listeners.push(func);

			return () => {
				const index = listeners.indexOf(func);
				index !== -1 && listeners.remove(index);
			};
		},

		fire(...args: T): void {
			for (const listener of listeners) {
				listener(...args);
			}
		},
	};
}

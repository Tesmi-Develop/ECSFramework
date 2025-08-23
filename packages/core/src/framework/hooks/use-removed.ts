import type { Modding } from "@flamework/core";
import { useHookState, useSystem } from "../flamecs";
import { ComponentKey, Entity, ResolveKey } from "../flamecs/registry";
import { VoidCallback } from "../utilities";

interface EventStorage<T> {
	connection?: VoidCallback;
	component: ComponentKey<T>;
	events: Array<[Entity, T]>;
}

/**
 * A hook that provides an iterable function that yields entities that have been removed.
 * It works by connecting to the Removed event of the system and storing the incoming events.
 * It returns the stored events in the order they were received.
 *
 * @param componentKey - The component key of the component to connect to.
 * @param key - An automatically generated key to store the event state.
 * @returns An iterable function that yields stored events.
 * @metadata macro
 */
export function useRemoved<T>(
	componentKey?: ComponentKey<T>,
	key?: Modding.Caller<"uuid">,
): IterableFunction<[Entity, T]> {
	assert(key);

	const storage = useHookState<EventStorage<T>>(key, componentKey, () => false);
	const system = useSystem();

	if (storage.component !== componentKey && storage.connection) {
		storage.connection();
		storage.connection = undefined;
	}
	if (!storage.connection) {
		storage.events = [];

		for (const entity of system.Each(componentKey as ResolveKey<T>)) {
			storage.events.push([entity, system.GetComponent(entity as never, componentKey as ResolveKey<T>) as never]);
		}

		// Store the component key and the connection.
		storage.component = componentKey!;
		storage.connection = system.Removed(componentKey as ComponentKey<T>).connect((entity) => storage.events.push([entity, system.GetComponent(entity as never, componentKey as ResolveKey<T>) as never]));
	}

	// Return an iterable function that yields the stored events.
	return (() => storage.events.shift()) as IterableFunction<[Entity, T]>;
}

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
 * Utility for handling event-like objects.
 *
 * Connects to the provided event-like object and stores incoming events.
 * Returns an iterable function that yields the stored events in the order they
 * were received.
 *
 * @template T - The tuple type of event arguments.
 * @param event - The event-like object to connect to.
 * @param discriminator - An optional value to additionally key by.
 * @param key - An automatically generated key to store the event state.
 * @returns An iterable function that yields stored events.
 * @metadata macro
 */
export function useAdded<T>(
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

		for (const entity of system.Each(componentKey as ComponentKey<unknown>)) {
			storage.events.push([entity, system.GetComponent(entity as never, componentKey as ResolveKey<T>) as never]);
		}

		storage.component = componentKey!;
		storage.connection = system.Added(componentKey).connect((entity, data) => storage.events.push([entity, data]));
	}

	return (() => storage.events.shift()) as IterableFunction<[Entity, T]>;
}

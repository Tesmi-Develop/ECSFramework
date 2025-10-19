import type { Modding } from "@flamework/core";
import { Calculate, createQuery, Id, ToIds, useHookState, useWorld } from "../flamecs";
import { CreateQueryChanged, QueryChanged } from "../jecs-utils/query-changed";

interface QueryChangedStorage {
	query: QueryChanged<Id<unknown>[]>;
}

/**
 * Utility for easy time-based throttling.
 *
 * Accepts a duration and returns `true` if it has been that long since the last
 * time this function returned `true`. Always returns `true` the first time.
 *
 * @param seconds - The number of seconds to throttle for.
 * @param discriminator - An optional value to additionally key by.
 * @param key - An automatically generated key to store the throttle state.
 * @returns - Returns true every x seconds, otherwise false.
 * @metadata macro
 */
export function queryChanged<T extends Array<unknown> = []>(
	terms?: ToIds<Calculate<T>["query"]>,
	filterWithout?: ToIds<Calculate<T>["without"]>,
	filterWith?: ToIds<Calculate<T>["with"]>,
	key?: Modding.Caller<"uuid">,
) {
	const storage = useHookState<QueryChangedStorage>(key!, undefined, () => false);
	const world = useWorld();

	if (storage.query === undefined) {
		storage.query = CreateQueryChanged(createQuery(world, terms, filterWithout, filterWith));
	}

	return storage.query.iter;
}

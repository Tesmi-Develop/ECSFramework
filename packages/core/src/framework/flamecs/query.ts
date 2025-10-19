import * as ecs from "@rbxts/jecs";

import type { ComponentKey, Entity, Id, ResolveKeys, ResolveValues, Unwrap } from "./registry";
import { component, getId } from "./registry";

// Almost full credits to @fireboltofdeath for all of these types.
export interface Without<T> {
	_flamecs_without: T;
}
export interface With<T> {
	_flamecs_with: T;
}

export type Skip<T extends Array<unknown>> = T extends [unknown, ...infer R] ? R : [];

export interface Bounds {
	query: Array<unknown>;
	with: Array<unknown>;
	without: Array<unknown>;
}

export type BoundsTuple<T> = T extends { length: number } & ReadonlyArray<unknown> ? T : [];

export type PushBound<B extends Bounds, K extends keyof B, V> = Omit<B, K> &
	Record<K, V extends ReadonlyArray<unknown> ? [...BoundsTuple<B[K]>, ...V] : [...BoundsTuple<B[K]>, V]>;

export type Calculate<T extends Array<unknown>, B extends Bounds = Bounds> = T extends []
	? { [k in keyof B]: BoundsTuple<B[k]> }
	: T[0] extends Without<infer V>
		? Calculate<Skip<T>, PushBound<B, "without", V>>
		: T[0] extends With<infer V>
			? Calculate<Skip<T>, PushBound<B, "with", V>>
			: Calculate<Skip<T>, PushBound<B, "query", T[0]>>;

export type ToIds<T> = T extends [] ? undefined : ResolveKeys<T>;

export type ExtractQueryTypes<T extends Array<unknown>> = Reconstruct<ResolveValues<Calculate<T>["query"]>>;

export type QueryHandle<T extends Array<unknown>> = {
	__iter(): IterableFunction<LuaTuple<[Entity, ...T]>>;
	world: ecs.World;
	filterWith?: Array<Id>;
	filterWithout?: Array<Id>;
	/**
	 * Adds a pair with a runtime entity id to the query. The value of the
	 * relationship is appended to the end of the iterator tuple.
	 *
	 * @template P - The type of the predicate component.
	 * @param object - The object component ID to filter.
	 * @param predicate - The optional predicate component key to filter.
	 * @returns A new QueryHandle with the pair filter added.
	 * @metadata macro
	 */
	pair<P>(object: Entity, predicate?: ComponentKey<P>): QueryHandle<[...T, Unwrap<P>]>;
	terms?: Array<Id>;
	querySource: ecs.Query<Array<Id>>;
} & IterableFunction<LuaTuple<[Entity, ...T]>>;

function queryPair<T extends Array<unknown>, P>(
	this: QueryHandle<T>,
	object: Entity,
	predicate?: ComponentKey<P>,
): QueryHandle<[...T, Unwrap<P>]> {
	assert(predicate);
	const id = ecs.pair(component(this.world, predicate), object);
	this.terms = this.terms ? [...this.terms, id] : [id];
	return this as unknown as QueryHandle<[...T, Unwrap<P>]>;
}

function queryIter<T extends Array<unknown>>(this: QueryHandle<T>): IterableFunction<LuaTuple<[Entity, ...T]>> {
	if (this.terms) {
		let ecsQuery = this.world.query(...this.terms);

		if (this.filterWithout) {
			ecsQuery = ecsQuery.without(...this.filterWithout);
		}

		if (this.filterWith) {
			ecsQuery = ecsQuery.with(...this.filterWith);
		}

		return ecsQuery.iter() as IterableFunction<LuaTuple<[Entity, ...T]>>;
	}

	return (() => {
		// Do nothing.
	}) as IterableFunction<LuaTuple<[Entity, ...T]>>;
}

export function createQuery<T extends Array<unknown> = []>(
	world: ecs.World,
	terms?: ToIds<Calculate<T>["query"]>,
	filterWithout?: ToIds<Calculate<T>["without"]>,
	filterWith?: ToIds<Calculate<T>["with"]>,
): ecs.Query<Array<Id>> {
	const processedTerms = terms?.map((v) => getId(world, v));
	const processedFilterWithout = filterWithout?.map((v) => getId(world, v));
	const processedFilterWith = filterWith?.map((v) => getId(world, v));

	if (processedTerms) {
		let ecsQuery = world.query(...processedTerms);

		if (processedFilterWithout) {
			ecsQuery = ecsQuery.without(...processedFilterWithout);
		}

		if (processedFilterWith) {
			ecsQuery = ecsQuery.with(...processedFilterWith);
		}

		return ecsQuery;
	}

	return world.query();
}

/**
 * A world contains entities associated with some components. This function
 * creates a query handle for retrieving entities that match the specified
 * components and filters.
 *
 * @template T - The types of the components involved in the query.
 * @param terms - The component IDs to be queried.
 * @param filterWithout - The component IDs that entities must not have.
 * @param filterWith - The component IDs that entities must have.
 * @returns A QueryHandle for chaining additional filters or executing the
 *   query.
 * @metadata macro
 */
export function query<T extends Array<unknown> = []>(
	registry: ecs.World,
	terms?: ToIds<Calculate<T>["query"]>,
	filterWithout?: ToIds<Calculate<T>["without"]>,
	filterWith?: ToIds<Calculate<T>["with"]>,
): QueryHandle<ExtractQueryTypes<T>> {
	const processedTerms = terms?.map((v) => getId(registry, v));
	const processedFilterWithout = filterWithout?.map((v) => getId(registry, v));
	const processedFilterWith = filterWith?.map((v) => getId(registry, v));

	const queryHandle = {
		world: registry,
		__iter: queryIter,
		filterWith: processedFilterWith,
		filterWithout: processedFilterWithout,
		pair: queryPair,
		terms: processedTerms,
	} as QueryHandle<ExtractQueryTypes<T>>;
	setmetatable(queryHandle, queryHandle as LuaMetatable<QueryHandle<ExtractQueryTypes<T>>>);
	return queryHandle;
}

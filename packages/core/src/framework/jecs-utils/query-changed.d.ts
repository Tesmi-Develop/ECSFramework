import { Id, IterFn, Query } from "@rbxts/jecs";

interface QueryChanged<T extends Id<unknown>[]> {
	__iter: () => IterFn<T>;
	disconnect: () => void;
	iter: () => IterFn<T>;
}

type CreateQueryChanged = <T extends Id<unknown>[]>(query: Query<T>) => QueryChanged<T>;

declare const CreateQueryChanged: CreateQueryChanged;
export { CreateQueryChanged, QueryChanged };

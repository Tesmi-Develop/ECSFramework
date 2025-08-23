import { Reflect } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { meta, World } from "@rbxts/jecs";
import { Entity } from "./flamecs";
import { getId, ResolveKey } from "./flamecs/registry";
import { RunService } from "@rbxts/services";

export function GetIdentifier(obj: object, suffix = ""): string {
	return Reflect.getMetadata<string>(obj, "identifier") ?? `UnidentifiedFlameworkListener${suffix}`;
}

export const GetClassName = (object: object): string => {
	return `${getmetatable(object)}`;
};

export function getDeferredConstructor<T extends object>(ctor: Constructor<T>) {
	const obj = setmetatable({}, ctor as never) as InstanceType<T>;

	return [
		obj,
		(...args: ConstructorParameters<Constructor<T>>) => {
			const result = (obj as { "constructor"(...args: unknown[]): unknown }).constructor(...args);
			assert(result === undefined || result === obj, `Deferred constructors are not allowed to return values.`);
		},
	] as const;
}

export type VoidCallback = () => void;
export const enum RunContext {
	Server,
	Client,
	Shared,
}

export const INSTANCE_ATTRIBUTE_ENTITY_ID = `__${RunService.IsServer() ? "Server" : "Client"}_EntityId`;
export const SERVER_ATTRIBUTE_ENTITY_ID = `__Server_EntityId`;

/** @metadata macro */
export function DefineClassComponentMeta<T>(ctor: Constructor, value?: unknown, key?: ResolveKey<T>) {
	const metadata = [key, value] as const;
	const datas = Reflect.getOwnMetadata<unknown[]>(ctor, "ECSFramework:Meta") ?? [];
	Reflect.defineMetadata(ctor, "ECSFramework:Meta", [...datas, metadata]);
}

export function ApplyClassComponentMeta(ctor: Constructor, componentRuntimeId: Entity) {
	const datas = Reflect.getOwnMetadata<[key: ResolveKey<unknown>, value: unknown][]>(ctor, "ECSFramework:Meta");
	if (datas === undefined) return;

	datas.forEach(([key, value]) => {
		meta(componentRuntimeId, getId(undefined, key), value);
	});
}

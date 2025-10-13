import { Reflect } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { meta, World } from "@rbxts/jecs";
import { Entity } from "./flamecs";
import { ComponentKey, getId, ResolveKey } from "./flamecs/registry";
import { RunService } from "@rbxts/services";
import { BaseSystem } from "./base-system";

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

/**
 * @metadata macro
 */
export function DefineClassComponentMeta<T>(targetId: string, value: unknown, key?: ComponentKey<T>): void {
	const metadata = [key, value] as const;

	const datas =
		(Reflect.getOwnMetadata(BaseSystem, "ECSFramework:Meta") as Record<string, Array<[string, unknown]>>) ?? {};

	Reflect.defineMetadata(BaseSystem, "ECSFramework:Meta", datas);

	const componentMetadata = datas[targetId] ?? [];
	componentMetadata.push(metadata as [ComponentKey<unknown>, unknown]);
	datas[targetId] = componentMetadata;
}

export function ApplyClassComponentMeta(componentRuntimeId: Entity, componentId: string): void {
	const datas = Reflect.getOwnMetadata(BaseSystem, "ECSFramework:Meta") as
		| Record<string, Array<[ComponentKey<unknown>, unknown]>>
		| undefined;

	if (!datas || !datas[componentId]) return;

	for (const [key, value] of datas[componentId]) {
		meta(componentRuntimeId, getId(undefined, key), value);
	}
}

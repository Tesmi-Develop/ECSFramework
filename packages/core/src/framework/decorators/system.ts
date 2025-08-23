import { Reflect } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { BaseSystem } from "../base-system";
import { RunContext } from "../utilities";

export interface SystemOptions {
	Priority?: number;
	RunContext?: RunContext;
}

/** @metadata reflect identifier */
export function ECSSystem(options: SystemOptions = {}) {
	return function (target: Constructor<BaseSystem>) {
		const systems: object[] = Reflect.getOwnMetadata(BaseSystem, "ECSFramework:Systems") ?? [];

		systems.push(target);
		Reflect.defineMetadata(BaseSystem, "ECSFramework:Systems", systems);
		Reflect.defineMetadata(target, "ECSFramework:Options", options);
	};
}

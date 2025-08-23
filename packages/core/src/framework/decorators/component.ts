import { Reflect } from "@flamework/core";
import { component } from "@rbxts/jecs";
import { BaseSystem } from "../base-system";
import { GetIdentifier, RunContext } from "../utilities";

export interface ECSComponentOptions {
	RunContext?: RunContext;
}

/** @metadata reflect identifier */
export function ECSComponent(options: ECSComponentOptions = {}) {
	return function (target: object) {
		const components: object[] = Reflect.getMetadata(BaseSystem, "ECSFramework:Components") ?? [];
		const componentId = component();

		components.push(target);
		Reflect.defineMetadata(target, "ECSFramework:Id", componentId);
		Reflect.defineMetadata(target, "ECSFramework:ComponentOptions", options);
		Reflect.defineMetadata(BaseSystem, "ECSFramework:Components", components);
		const componentsId =
			Reflect.getOwnMetadata<Map<number, string>>(BaseSystem, "ECSFramework:ComponentsId") ?? new Map();
		componentsId.set(componentId, GetIdentifier(target));

		Reflect.defineMetadata(BaseSystem, "ECSFramework:ComponentsId", componentsId);
	};
}

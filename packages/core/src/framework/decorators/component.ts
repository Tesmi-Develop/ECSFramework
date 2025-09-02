import { Modding, Reflect } from "@flamework/core";
import { component } from "@rbxts/jecs";
import { BaseSystem } from "../base-system";
import { GetIdentifier, RunContext } from "../utilities";
import { Constructor } from "@flamework/core/out/utility";
import { t } from "@rbxts/t";

export interface ECSComponentOptions {
	RunContext?: RunContext;
}

/** @metadata reflect identifier macro */
export function ECSComponent<T>(options: ECSComponentOptions = {}) {
	return function (target: Constructor<T>) {
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

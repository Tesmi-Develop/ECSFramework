import { Reflect } from "@flamework/core";
import { component, tag } from "@rbxts/jecs";
import { BaseSystem } from "../base-system";
import { GetIdentifier, RunContext } from "../utilities";
import { Constructor } from "@flamework/core/out/utility";

export interface ECSComponentOptions {
	RunContext?: RunContext;
	IsTag?: boolean;
}

/** @metadata reflect identifier macro */
export function ECSComponent<T>(options: ECSComponentOptions = {}) {
	return function (target: Constructor<T>) {
		const components: object[] = Reflect.getMetadata(BaseSystem, "ECSFramework:Components") ?? [];
		const componentId = options.IsTag ? tag() : component();

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

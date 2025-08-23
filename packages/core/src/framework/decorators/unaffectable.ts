import { Reflect } from "@flamework/core";

export function Unaffectable() {
	return function (target: object) {
		Reflect.defineMetadata(target, "ECSFramework:Unaffectable", true);
	};
}

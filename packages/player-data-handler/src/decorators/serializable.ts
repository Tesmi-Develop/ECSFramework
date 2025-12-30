import { DefineClassComponentMeta } from "@ecsframework/core";
import { Constructor } from "@flamework/core/out/utility";
import { SerializableComponent } from "../types";
import { GetIdentifier } from "@ecsframework/core/out/framework/utilities";

/** @metadata macro */
export function Serializable<T extends object>() {
	return function (target: Constructor<T>) {
		DefineClassComponentMeta<SerializableComponent>(GetIdentifier(target), true);
	};
}

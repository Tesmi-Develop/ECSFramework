import { DefineClassComponentMeta } from "@ecsframework/core";
import { Modding } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { SavedData } from "../types";

type ConvertInObject<T> = { [P in keyof T]: T[P] };

/** @metadata macro */
export function Saved<T extends object>(
	options: SavedData<T> = {},
	guard?: Modding.Generic<ConvertInObject<T>, "guard">,
) {
	return function (target: Constructor<T>) {
		options.Guard = guard as never;
		DefineClassComponentMeta<SavedData>(target as never, options);
	};
}

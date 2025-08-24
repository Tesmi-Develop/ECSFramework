import { DefineClassComponentMeta, Tag } from "@ecsframework/core";
import { Modding } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { SavedOption } from "../types";

export interface SavedTag extends Tag {}

type ConvertInObject<T> = { [P in keyof T]: T[P] };

/** @metadata macro */
export function Saved<T extends object>(
	options: SavedOption<T> = {},
	guard?: Modding.Generic<ConvertInObject<T>, "guard">,
) {
	return function (target: Constructor<T>) {
		options.Guard = guard as never;
		DefineClassComponentMeta<SavedTag>(target as never, options);
	};
}

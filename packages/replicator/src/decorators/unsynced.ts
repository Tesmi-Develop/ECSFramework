import { GetComponentMeta, GetIdentifier } from "@ecsframework/core/out/framework/utilities";
import { Modding } from "@flamework/core";
import { ReplicatedTag } from "./replicated";

export const Unsynced = Modding.createDecorator<[]>("Property", (descriptor) => {
	const options =
		(GetComponentMeta<ReplicatedTag<unknown>>(GetIdentifier(descriptor.object)) as ReplicatedTag<unknown>) ?? {};
	options.unsyncedProperties ??= new Set<string>();
	options.unsyncedProperties.add(descriptor.property);
});

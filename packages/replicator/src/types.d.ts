export type RemoveTag = {
	__removed?: true;
};

// EntityId -> (ComponentId | RemovedEntityTag) -> (Data | RemovedEntityTag)
export type SyncData = Map<
	string,
	Map<string, { data: unknown; payloadType: "init" | "patch" } | RemoveTag> | RemoveTag
>;

// EntityId -> (ComponentId | RemovedEntityTag) -> (Data)
export type PrevSyncData = Map<string, Map<string, { prevState?: unknown; state?: unknown } | RemoveTag> | RemoveTag>;

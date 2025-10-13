const transformers = [] as {
	Serialize: (data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) => unknown;
	Deserialize: (data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) => unknown;
	IsMatchSerialize: (data: unknown, someData: {}) => boolean;
	IsMatchDeserialize: (data: unknown, someData: {}) => boolean;
	Priority: number;
}[];

export function registerTransformer(
	serialize: (data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) => unknown,
	deserialize: (data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) => unknown,
	isMatchSerialize: (data: unknown, someData: {}) => boolean,
	isMatchDeserialize: (data: unknown, someData: {}) => boolean,
	priority: number = 0,
) {
	transformers.push({
		Serialize: serialize,
		Deserialize: deserialize,
		Priority: priority,
		IsMatchSerialize: isMatchSerialize,
		IsMatchDeserialize: isMatchDeserialize,
	});
	transformers.sort((a, b) => a.Priority > b.Priority);
}

function serializeRecursive(data: unknown, someData: {}): unknown {
	for (const { Serialize, IsMatchSerialize } of transformers) {
		if (!IsMatchSerialize(data, someData)) continue;
		return Serialize(data, (data: unknown) => serializeRecursive(data, someData), someData);
	}

	return data;
}

export function Serialize<T>(data: T, someData: {}): unknown {
	return serializeRecursive(data, someData);
}

function deserializeRecursive(data: unknown, someData: {}): unknown {
	for (const { Deserialize, IsMatchDeserialize } of transformers) {
		if (!IsMatchDeserialize(data, someData)) continue;
		return Deserialize(data, (data: unknown) => deserializeRecursive(data, someData), someData);
	}

	return data;
}

export function Deserialize<T>(data: T, someData: {}): unknown {
	return deserializeRecursive(data, someData);
}

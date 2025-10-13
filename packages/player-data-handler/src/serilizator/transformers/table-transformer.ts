import { registerTransformer } from "..";

function TableTransformerSerialize(data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) {
	if (!typeIs(data, "table")) return data;

	const result = {};
	for (const [key, value] of pairs(data)) {
		result[key as never] = recursiveCallback(value) as never;
	}

	return result;
}

function TableTransformerDeserialize(data: unknown, recursiveCallback: (data: unknown) => unknown, someData: {}) {
	if (!typeIs(data, "table")) return data;

	const result = {};
	for (const [key, value] of pairs(data)) {
		result[key as never] = recursiveCallback(value) as never;
	}

	return result;
}

registerTransformer(
	TableTransformerSerialize,
	TableTransformerDeserialize,
	(data) => typeIs(data, "table"),
	(data) => typeIs(data, "table"),
	-math.huge,
);

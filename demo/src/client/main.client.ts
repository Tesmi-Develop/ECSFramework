import { ECSFramework } from "@ecsframework/core";
import { Flamework } from "@flamework/core";
import("@ecsframework/replicator").expect();

Flamework.addPaths("src/client");
Flamework.addPaths("src/shared");

new ECSFramework().Start();

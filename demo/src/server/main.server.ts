import { ECSFramework } from "@ecsframework/core";
import { Flamework } from "@flamework/core";
import("@ecsframework/replicator").expect();

Flamework.addPaths("src/server");
Flamework.addPaths("src/shared");

const framework = new ECSFramework();
framework.Start();

import { ECSFramework, Flamework } from "@ecsframework/core";
import("@ecsframework/replicator").expect();

Flamework.addPaths("src/client");
Flamework.addPaths("src/shared");

new ECSFramework().Start();

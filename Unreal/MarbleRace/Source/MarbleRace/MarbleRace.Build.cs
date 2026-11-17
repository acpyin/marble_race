using UnrealBuildTool;
public class MarbleRace : ModuleRules
{
    public MarbleRace(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[] {
            "Core", "CoreUObject", "Engine", "InputCore", "PhysicsCore", "ProceduralMeshComponent"
        });
    }
}

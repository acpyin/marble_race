using UnrealBuildTool;
public class MarbleRaceTarget : TargetRules
{
    public MarbleRaceTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("MarbleRace");
    }
}

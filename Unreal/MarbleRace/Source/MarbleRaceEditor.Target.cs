using UnrealBuildTool;
public class MarbleRaceEditorTarget : TargetRules
{
    public MarbleRaceEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("MarbleRace");
    }
}

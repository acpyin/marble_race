#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/HUD.h"
#include "GameFramework/GameModeBase.h"
#include "RaceRuntime.generated.h"

class UProceduralMeshComponent;
class USphereComponent;
class UPhysicalMaterial;
class UMaterialInterface;
class ACameraActor;

UCLASS()
class MARBLERACE_API ARaceWorld : public AActor
{
    GENERATED_BODY()
public:
    ARaceWorld();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    void StartRace();
    void ResetRace();
    FVector FocusPoint(int32 Index) const;
    static FVector Center(float S);
    static FVector Right(float S);
    UPROPERTY(VisibleAnywhere) TObjectPtr<UProceduralMeshComponent> Track;
    UPROPERTY() TArray<TObjectPtr<USphereComponent>> Balls;
    UPROPERTY() TObjectPtr<UPhysicalMaterial> SurfacePhysics;
    UPROPERTY() TObjectPtr<UPhysicalMaterial> BallPhysics;
    TArray<FVector> StartPositions;
    TArray<float> FinishTimes;
    TArray<float> Progress;
    bool bRunning = false;
    float RaceTime = 0.f;
    int32 FocusIndex = 0;
private:
    void BuildTrack();
    void Barrier(float S1, float Offset1, float S2, float Offset2, float Height, float Thickness);
    void Peg(float S, float Offset);
    UMaterialInterface* LoadMaterial(const TCHAR* Name) const;
};

UCLASS()
class MARBLERACE_API ARaceController : public APlayerController
{
    GENERATED_BODY()
public:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaTime) override;
private:
    UPROPERTY() TObjectPtr<ACameraActor> RaceCamera;
    UPROPERTY() TObjectPtr<ARaceWorld> Race;
    FVector Pivot = FVector(0, 0, 100);
    float Yaw = 165.f;
    float Pitch = 28.f;
    float Distance = 70.f;
    bool bFollow = true;
    void Zoom(float Amount);
    void Start();
    void Reset();
    void Follow();
    void Next();
};

UCLASS()
class MARBLERACE_API ARaceHUD : public AHUD
{
    GENERATED_BODY()
public:
    virtual void DrawHUD() override;
};

UCLASS()
class MARBLERACE_API ARaceGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    ARaceGameMode();
    virtual void BeginPlay() override;
};

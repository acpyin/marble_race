#include "RaceRuntime.h"
#include "ProceduralMeshComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "PhysicalMaterials/PhysicalMaterial.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/StaticMesh.h"
#include "Engine/Canvas.h"
#include "Materials/MaterialInterface.h"

namespace { constexpr float Length = 520.f; constexpr float HalfWidth = 12.f; constexpr float Radius = .8f; }

ARaceWorld::ARaceWorld()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PostPhysics;
    Track = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("ContinuousTrack"));
    RootComponent = Track;
    Track->bUseComplexAsSimpleCollision = true;
    Track->SetCollisionProfileName(TEXT("BlockAll"));
}

FVector ARaceWorld::Center(float S)
{
    const float T = FMath::Clamp((S - 95.f) / 425.f, 0.f, 1.f);
    return FVector(S, S < 95.f ? 0.f : 18.f * FMath::Sin(T * PI * 3.f), 110.f - S * .13f);
}
FVector ARaceWorld::Right(float S)
{
    FVector Forward = Center(S + .1f) - Center(S - .1f);
    Forward.Z = 0;
    return FVector::CrossProduct(FVector::UpVector, Forward.GetSafeNormal()).GetSafeNormal();
}
UMaterialInterface* ARaceWorld::LoadMaterial(const TCHAR* Name) const
{
    return LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Materials/%s.%s"), Name, Name));
}

void ARaceWorld::BuildTrack()
{
    TArray<FVector> Vertices;
    TArray<int32> Indices;
    TArray<FVector2D> UVs;
    TArray<FVector> Normals;
    TArray<FProcMeshTangent> Tangents;
    auto Quad = [&](const FVector& A, const FVector& B, const FVector& C, const FVector& D, float U) {
        const int32 Base = Vertices.Num();
        Vertices.Append({A, B, C, D});
        UVs.Append({FVector2D(U, 0), FVector2D(U, 1), FVector2D(U + .1f, 1), FVector2D(U + .1f, 0)});
        const FVector Normal = FVector::CrossProduct(C - A, B - A).GetSafeNormal();
        for(int32 I=0; I<4; ++I){
            Normals.Add(Normal);
            Tangents.Add(FProcMeshTangent((D-A).GetSafeNormal(),false));
        }
        // Both windings keep the static surface collision visible from either side.
        Indices.Append({Base, Base + 2, Base + 1, Base, Base + 3, Base + 2,
                        Base, Base + 1, Base + 2, Base, Base + 2, Base + 3});
    };
    for (float S = 0; S < Length; S += 2.f) {
        const float Next = FMath::Min(S + 2.f, Length);
        const FVector A = Center(S), B = Center(Next), RA = Right(S), RB = Right(Next);
        Quad(A - RA * HalfWidth, A + RA * HalfWidth, B + RB * HalfWidth, B - RB * HalfWidth, S / 20);
        Quad(A - RA * HalfWidth - FVector(0,0,1), B - RB * HalfWidth - FVector(0,0,1),
             B + RB * HalfWidth - FVector(0,0,1), A + RA * HalfWidth - FVector(0,0,1), S / 20);
        for (float Sign : {-1.f, 1.f}) {
            const FVector P = A + RA * HalfWidth * Sign, Q = B + RB * HalfWidth * Sign;
            Quad(P, Q, Q + FVector(0,0,5), P + FVector(0,0,5), S / 20);
        }
    }
    TArray<FLinearColor> Colors;
    Track->CreateMeshSection_LinearColor(0, Vertices, Indices, Normals, UVs, Colors, Tangents, true);
    Track->SetMaterial(0, LoadMaterial(TEXT("M_Wood")));
    Track->SetPhysMaterialOverride(SurfacePhysics);

    // Rails connect to side walls; inner faces of the throat have 3.5 cm clearance.
    Barrier(45, -12.1f, 85, -1.95f, 3.5f, .4f);
    Barrier(45, 12.1f, 85, 1.95f, 3.5f, .4f);
    Barrier(85, -1.95f, 95, -1.95f, 3.5f, .4f);
    Barrier(85, 1.95f, 95, 1.95f, 3.5f, .4f);
    for (int32 Row = 0; Row < 9; ++Row) {
        for (float Offset = -8.f + (Row % 2) * 2.f; Offset <= 8.f; Offset += 4.f)
            Peg(118.f + Row * 8.f, Offset);
    }
    // Descending oblique faces leave > 4 cm on their downstream escape side.
    for (int32 I = 0; I < 5; ++I) {
        const float Sign = I % 2 ? -1.f : 1.f;
        Barrier(220.f + I * 27.f, Sign * 12.1f, 237.f + I * 27.f, -Sign * 4.f, 3.5f, .7f);
    }
    Barrier(519, -12, 519, 12, 6, 1);
}

void ARaceWorld::Barrier(float S1, float Offset1, float S2, float Offset2, float Height, float Thickness)
{
    const FVector A = Center(S1) + Right(S1) * Offset1;
    const FVector B = Center(S2) + Right(S2) * Offset2;
    UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(this);
    Part->SetupAttachment(RootComponent);
    Part->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")));
    Part->SetWorldLocation((A + B) * .5f + FVector(0,0,Height * .5f));
    Part->SetWorldRotation((B - A).Rotation());
    Part->SetWorldScale3D(FVector((B - A).Size() / 100.f, Thickness / 100.f, Height / 100.f));
    Part->SetCollisionProfileName(TEXT("BlockAll"));
    Part->SetMaterial(0, LoadMaterial(TEXT("M_Metal")));
    Part->SetPhysMaterialOverride(SurfacePhysics);
    Part->RegisterComponent();
    AddInstanceComponent(Part);
}

void ARaceWorld::Peg(float S, float Offset)
{
    UStaticMeshComponent* Part = NewObject<UStaticMeshComponent>(this);
    Part->SetupAttachment(RootComponent);
    Part->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder")));
    Part->SetWorldLocation(Center(S) + Right(S) * Offset + FVector(0,0,2.f));
    Part->SetWorldScale3D(FVector(.009f,.009f,.04f));
    Part->SetCollisionProfileName(TEXT("BlockAll"));
    Part->SetPhysMaterialOverride(SurfacePhysics);
    Part->SetMaterial(0, LoadMaterial(TEXT("M_Wood")));
    Part->RegisterComponent();
    AddInstanceComponent(Part);
}

void ARaceWorld::BeginPlay()
{
    Super::BeginPlay();
    SurfacePhysics = NewObject<UPhysicalMaterial>(this);
    SurfacePhysics->Friction = .18f;
    SurfacePhysics->Restitution = .18f;
    BallPhysics = NewObject<UPhysicalMaterial>(this);
    BallPhysics->Friction = .2f;
    BallPhysics->Restitution = .3f;
    BuildTrack();
    const TCHAR* Styles[] = {TEXT("M_GlassCyan"),TEXT("M_GlassPurple"),TEXT("M_Stars"),TEXT("M_Galaxy"),
                             TEXT("M_Fire"),TEXT("M_Candy"),TEXT("M_Metal"),TEXT("M_GlassGreen")};
    for (int32 I = 0; I < 8; ++I) {
        USphereComponent* Ball = NewObject<USphereComponent>(this);
        Ball->SetupAttachment(RootComponent);
        Ball->InitSphereRadius(Radius);
        Ball->SetCollisionProfileName(TEXT("PhysicsActor"));
        Ball->SetPhysMaterialOverride(BallPhysics);
        Ball->BodyInstance.bUseCCD = true;
        Ball->BodyInstance.PositionSolverIterationCount = 16;
        Ball->BodyInstance.VelocitySolverIterationCount = 8;
        Ball->SetLinearDamping(.01f);
        Ball->SetAngularDamping(.02f);
        Ball->RegisterComponent();
        AddInstanceComponent(Ball);
        UStaticMeshComponent* Visual = NewObject<UStaticMeshComponent>(this);
        Visual->SetupAttachment(Ball);
        Visual->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere")));
        Visual->SetRelativeScale3D(FVector(Radius / 50.f));
        Visual->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Visual->SetMaterial(0, LoadMaterial(Styles[I]));
        Visual->RegisterComponent();
        AddInstanceComponent(Visual);
        Balls.Add(Ball);
        StartPositions.Add(Center(8.f + (I % 2) * 2.f) + Right(8) * (-8.f + I * 2.2f) + FVector(0,0,Radius + .1f));
    }
    ResetRace();
}
void ARaceWorld::ResetRace()
{
    bRunning = false;
    RaceTime = 0;
    FinishTimes.Init(-1.f, Balls.Num());
    Progress.Init(0.f, Balls.Num());
    for (int32 I = 0; I < Balls.Num(); ++I) {
        Balls[I]->SetSimulatePhysics(false);
        Balls[I]->SetWorldLocationAndRotation(StartPositions[I], FRotator::ZeroRotator, false, nullptr, ETeleportType::TeleportPhysics);
    }
}
void ARaceWorld::StartRace()
{
    if (bRunning) return;
    for (USphereComponent* Ball : Balls) {
        Ball->SetSimulatePhysics(true);
        Ball->SetMassOverrideInKg(NAME_None, .006f, true);
        Ball->SetPhysicsLinearVelocity(FVector::ZeroVector);
        Ball->SetPhysicsAngularVelocityInRadians(FVector::ZeroVector);
        Ball->WakeAllRigidBodies();
    }
    bRunning = true;
}
FVector ARaceWorld::FocusPoint(int32 Index) const
{
    return Balls.IsValidIndex(Index) ? Balls[Index]->GetComponentLocation() : Center(10);
}
void ARaceWorld::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!bRunning) return;
    RaceTime += DeltaSeconds;
    bool AllFinished = true;
    for (int32 I = 0; I < Balls.Num(); ++I) {
        Progress[I] = Balls[I]->GetComponentLocation().X;
        if (FinishTimes[I] < 0 && Progress[I] >= 505.f) FinishTimes[I] = RaceTime;
        if (FinishTimes[I] < 0) AllFinished = false;
    }
    if (AllFinished || RaceTime >= 120.f) bRunning = false;
}

void ARaceController::BeginPlay()
{
    Super::BeginPlay();
    bShowMouseCursor = true;
    RaceCamera = GetWorld()->SpawnActor<ACameraActor>();
    RaceCamera->GetCameraComponent()->SetFieldOfView(45.f);
    SetViewTarget(RaceCamera);
    Race = Cast<ARaceWorld>(UGameplayStatics::GetActorOfClass(GetWorld(), ARaceWorld::StaticClass()));
}
void ARaceController::SetupInputComponent()
{
    Super::SetupInputComponent();
    InputComponent->BindAction("StartRace", IE_Pressed, this, &ARaceController::Start);
    InputComponent->BindAction("ResetRace", IE_Pressed, this, &ARaceController::Reset);
    InputComponent->BindAction("FollowCamera", IE_Pressed, this, &ARaceController::Follow);
    InputComponent->BindAction("NextMarble", IE_Pressed, this, &ARaceController::Next);
    InputComponent->BindAxis("Zoom", this, &ARaceController::Zoom);
}
void ARaceController::Zoom(float Amount)
{
    if (FMath::IsNearlyZero(Amount)) return;
    bFollow = false;
    Distance = FMath::Clamp(Distance * FMath::Pow(.85f, Amount), 8.f, 900.f);
}
void ARaceController::Start(){ if(Race) Race->StartRace(); }
void ARaceController::Reset(){ if(Race) Race->ResetRace(); }
void ARaceController::Follow(){ bFollow = true; }
void ARaceController::Next(){ if(Race) Race->FocusIndex = (Race->FocusIndex + 1) % 8; }
void ARaceController::PlayerTick(float DeltaTime)
{
    Super::PlayerTick(DeltaTime);
    if (!Race) Race = Cast<ARaceWorld>(UGameplayStatics::GetActorOfClass(GetWorld(), ARaceWorld::StaticClass()));
    if (!RaceCamera) return;
    float DX, DY;
    GetInputMouseDelta(DX, DY);
    if (IsInputKeyDown(EKeys::RightMouseButton)) {
        bFollow = false;
        Yaw -= DX * .3f;
        Pitch = FMath::Clamp(Pitch + DY * .3f, 5.f, 85.f);
    }
    if (bFollow && Race) Pivot = FMath::VInterpTo(Pivot, Race->FocusPoint(Race->FocusIndex), DeltaTime, 6.f);
    const FVector Offset = FRotator(Pitch, Yaw, 0).Vector() * Distance;
    RaceCamera->SetActorLocation(Pivot + Offset);
    RaceCamera->SetActorRotation((Pivot - RaceCamera->GetActorLocation()).Rotation());
}

void ARaceHUD::DrawHUD()
{
    Super::DrawHUD();
    ARaceWorld* Race = Cast<ARaceWorld>(UGameplayStatics::GetActorOfClass(GetWorld(), ARaceWorld::StaticClass()));
    DrawText(TEXT("MARBLE RACE | UE5 VERTICAL SLICE"), FLinearColor::White, 25, 20);
    DrawText(TEXT("SPACE: Start | R: Reset | RMB drag: Orbit | Wheel: Zoom | F: Follow | TAB: Next"), FLinearColor::White, 25, 48);
    if (!Race) return;
    TArray<int32> Order;
    for(int32 I=0; I<Race->Balls.Num(); ++I) Order.Add(I);
    Order.Sort([&](int32 A,int32 B){
        const bool FA=Race->FinishTimes[A]>=0, FB=Race->FinishTimes[B]>=0;
        if(FA&&FB)return Race->FinishTimes[A]<Race->FinishTimes[B];
        if(FA!=FB)return FA;
        return Race->Progress[A]>Race->Progress[B];
    });
    DrawText(FString::Printf(TEXT("TIME %.2f s | FOCUS %d"), Race->RaceTime, Race->FocusIndex+1), FLinearColor::White, 25, 80);
    for(int32 Rank=0; Rank<Order.Num(); ++Rank){
        const int32 I=Order[Rank];
        const FString Status=Race->FinishTimes[I]>=0 ? FString::Printf(TEXT("%.3f s"),Race->FinishTimes[I]) : FString::Printf(TEXT("%.1f cm"),Race->Progress[I]);
        DrawText(FString::Printf(TEXT("%d. Marble %d | %s"),Rank+1,I+1,*Status),FLinearColor::White,25,110+Rank*22);
    }
}
ARaceGameMode::ARaceGameMode()
{
    PlayerControllerClass=ARaceController::StaticClass();
    HUDClass=ARaceHUD::StaticClass();
    DefaultPawnClass=nullptr;
}
void ARaceGameMode::BeginPlay()
{
    Super::BeginPlay();
    if(!UGameplayStatics::GetActorOfClass(GetWorld(),ARaceWorld::StaticClass()))GetWorld()->SpawnActor<ARaceWorld>();
}

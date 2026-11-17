"""Run in the UE5 editor Python console after compiling the project.
exec(open(r'<project>/Tools/GenerateWorkshop.py', encoding='utf-8').read())
Creates prototype material assets and a persistent lighting map. No external packages required.
"""
import unreal

ROOT = '/Game/Materials'
unreal.EditorAssetLibrary.make_directory(ROOT)
unreal.EditorAssetLibrary.make_directory('/Game/Maps')
assets = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.MaterialEditingLibrary

def constant(material, value, prop):
    if isinstance(value, tuple):
        node = lib.create_material_expression(material, unreal.MaterialExpressionConstant3Vector)
        node.set_editor_property('constant', unreal.LinearColor(*value, 1.0))
    else:
        node = lib.create_material_expression(material, unreal.MaterialExpressionConstant)
        node.set_editor_property('r', value)
    lib.connect_material_property(node, '', prop)

def pattern(material, code):
    uv = lib.create_material_expression(material, unreal.MaterialExpressionTextureCoordinate)
    shader = lib.create_material_expression(material, unreal.MaterialExpressionCustom)
    shader.set_editor_property('code', code)
    shader.set_editor_property('output_type', unreal.CustomMaterialOutputType.CMOT_FLOAT3)
    inp = unreal.CustomInput()
    inp.set_editor_property('input_name', 'UV')
    shader.set_editor_property('inputs', [inp])
    lib.connect_material_expressions(uv, '', shader, 'UV')
    lib.connect_material_property(shader, '', unreal.MaterialProperty.MP_BASE_COLOR)

PATTERNS = {
    'M_Wood': '''float grain=sin(UV.x*175+sin(UV.y*11)*4)*.03;
      float fibre=sin(UV.x*800+sin(UV.y*21)*8)*.013;
      return float3(.38,.21,.085)+grain+fibre;''',
    'M_Stars': '''float2 cell=floor(UV*float2(350,175));
      float h=frac(sin(dot(cell,float2(12.9898,78.233)))*43758.5453);
      float star=step(.996,h)*(1-smoothstep(.08,.38,length(frac(UV*float2(350,175))-.5)));
      return float3(.012,.006,.04)+star*float3(.9,.9,1);''',
    'M_Galaxy': '''float band=exp(-pow((UV.y-.5-sin(UV.x*12)*.15)*8,2));
      float n=frac(sin(dot(floor(UV*float2(420,210)),float2(19.2,71.4)))*43123.12);
      return float3(.008,.01,.04)+band*float3(.16,.06,.38)+step(.997,n)*.8;''',
    'M_Fire': '''float wave=sin(UV.x*45+sin(UV.y*18)*4)*.11;
      float heat=saturate(.9-UV.y+wave);
      return lerp(float3(.09,.003,.001),float3(1,.08,.003),heat)+pow(heat,4)*float3(.9,.65,.05);''',
    'M_Candy': '''float a=atan2(UV.y-.5,UV.x-.5);
      float r=length(UV-.5);
      float stripe=smoothstep(-.1,.1,sin(a*7-r*35));
      return lerp(float3(.95,.88,.75),float3(.85,.025,.15),stripe);'''
}

def material(name, color=(.3,.3,.3), metal=0.0, rough=.12, glass=False):
    path=f'{ROOT}/{name}'
    mat=unreal.EditorAssetLibrary.load_asset(path)
    if mat:
        unreal.log(f'Preserving existing asset: {path}')
        return mat
    mat=assets.create_asset(name, ROOT, unreal.Material, unreal.MaterialFactoryNew())
    constant(mat, metal, unreal.MaterialProperty.MP_METALLIC)
    constant(mat, rough, unreal.MaterialProperty.MP_ROUGHNESS)
    if name in PATTERNS:
        pattern(mat, PATTERNS[name])
    else:
        constant(mat, color, unreal.MaterialProperty.MP_BASE_COLOR)
    if glass:
        mat.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
        constant(mat, .58, unreal.MaterialProperty.MP_OPACITY)
        constant(mat, 1.45, unreal.MaterialProperty.MP_REFRACTION)
    lib.recompile_material(mat)
    unreal.EditorAssetLibrary.save_asset(path)
    return mat

wood=material('M_Wood', rough=.55)
material('M_Metal', (.58,.5,.2), .9, .16)
material('M_GlassCyan', (.015,.5,.55), glass=True)
material('M_GlassPurple', (.24,.025,.5), glass=True)
material('M_GlassGreen', (.025,.4,.13), glass=True)
for name in ['M_Stars','M_Galaxy','M_Fire','M_Candy']:
    material(name, metal=.08)
room=material('M_Room', (.45,.45,.42), rough=.9)

map_path='/Game/Maps/Workshop'
if unreal.EditorAssetLibrary.does_asset_exist(map_path):
    unreal.log('Workshop map already exists; preserving user edits.')
else:
    level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    level.new_level(map_path)
    cube=unreal.load_asset('/Engine/BasicShapes/Cube')
    def box(label, location, scale, mat):
        actor=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*location))
        actor.set_actor_label(label)
        mesh=actor.static_mesh_component
        mesh.set_static_mesh(cube)
        mesh.set_material(0,mat)
        actor.set_actor_scale3d(unreal.Vector(*scale))
        return actor
    box('Room floor',(260,0,-8),(7.5,5,.15),room)
    box('Workshop wall',(260,-85,155),(7.5,.15,3.3),room)
    for distance in [30,140,250,360,470]:
        for side in [-20,20]:
            top=110-distance*.13
            box('Wood support',(distance,side,(top-5)/2),( .035,.035,(top-5)/100),wood)
    light=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(200,80,250))
    light.set_actor_label('Soft daylight')
    light.set_actor_rotation(unreal.Rotator(-42,-35,0),False)
    light.directional_light_component.set_editor_property('intensity',3.0)
    light.directional_light_component.set_editor_property('light_source_angle',3.0)
    sky=unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyLight,unreal.Vector(260,0,200))
    sky.set_actor_label('Indoor ambient fill')
    sky.light_component.set_editor_property('intensity',.65)
    level.save_current_level()

unreal.log('Workshop assets created. Press Play. SPACE starts, RMB orbits, wheel zooms, F follows, TAB selects, R resets.')

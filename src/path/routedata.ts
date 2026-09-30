/**
 * Authored map data. The path editor overwrites this file (Save TypeScript).
 */

export const SHIP_ROUTE = {
  y: 0,
  accelDecel: 2,
  planets: [
    {
      name: 'Terra',
      model: 'assets/scene/Models/Planets/Terra.gltf',
      x: -266.09,
      y: 0,
      z: 139.23,
      radius: 128.74
    },
    {
      name: 'Sun',
      model: 'assets/scene/Models/Sun.gltf',
      x: 217.97,
      y: 0,
      z: 1300.26,
      radius: 642.72
    },
    {
      name: 'Vaelith',
      model: 'assets/scene/Models/Planets/Vaelith.gltf',
      x: -1459.33,
      y: 0,
      z: 4946.3,
      radius: 207.56
    },
    {
      name: 'Korund',
      model: 'assets/scene/Models/Planets/Korund.gltf',
      x: 6181.18,
      y: 0,
      z: 7981.74,
      radius: 114.45
    },
    {
      name: 'Sablemere',
      model: 'assets/scene/Models/Planets/Sablemere.gltf',
      x: 12040.88,
      y: 0,
      z: 1527.85,
      radius: 205.76
    },
    {
      name: 'Orpheon',
      model: 'assets/scene/Models/Planets/Orpheon.gltf',
      x: 20817.71,
      y: 0,
      z: -433.37,
      radius: 94.08
    },
    {
      name: 'Drenovar',
      model: 'assets/scene/Models/Planets/Drenovar.gltf',
      x: 9608.57,
      y: 0,
      z: -12799.7,
      radius: 73.74
    },
    {
      name: 'Caelum',
      model: 'assets/scene/Models/Planets/Caelum.gltf',
      x: 19279.05,
      y: 0,
      z: -8398.96,
      radius: 173.08
    }
  ],
  legs: [
    {
      stopId: 'Terra',
      points: [
        { x: 647.73, z: -396.86 },
        { x: -44, z: 184.42 }
      ]
    },
    {
      stopId: 'Vaelith',
      points: [
        { x: -44, z: 184.42 },
        { x: -1256.83, z: 1672.51 },
        { x: -1324.9, z: 4433.08 }
      ]
    },
    {
      stopId: 'Korund',
      points: [
        { x: -1324.9, z: 4433.08 },
        { x: 1755.22, z: 7194.28 },
        { x: 6079.79, z: 8318.73 }
      ]
    },
    {
      stopId: 'Sablemere',
      points: [
        { x: 6079.79, z: 8318.73 },
        { x: 8155.22, z: 5634.28 },
        { x: 9795.22, z: 3194.28 },
        { x: 11639.79, z: 1263.9 }
      ]
    },
    {
      stopId: 'Orpheon',
      points: [
        { x: 11639.79, z: 1263.9 },
        { x: 15415.22, z: 834.28 },
        { x: 18683.3, z: 618.12 },
        { x: 21046.81, z: -184.01 }
      ]
    },
    {
      stopId: 'Caelum',
      points: [
        { x: 21046.81, z: -184.01 },
        { x: 21021.11, z: -3322.59 },
        { x: 20321.11, z: -6062.59 },
        { x: 19141.12, z: -8069.03 }
      ]
    },
    {
      stopId: 'Drenovar',
      points: [
        { x: 19141.12, z: -8069.03 },
        { x: 15821.11, z: -10062.59 },
        { x: 12341.11, z: -11682.59 },
        { x: 9822.11, z: -12934.81 }
      ]
    }
  ]
}

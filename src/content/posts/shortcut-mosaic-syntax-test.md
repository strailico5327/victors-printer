---
title: Shortcut Mosaic Syntax Test
published: 2026-06-25
category: Tech
draft: true
proseStyle: literary
tags:
    - Test
    - Shortcuts
    - Images
---

This draft post exercises the custom image shortcut parser with iPod captured images.

## Single Image: Auto Gallery

:!img ipod-01.jpeg

```md
:!img ipod-01.jpeg
```

## Single Image: Width

:!img ipod-02.jpeg 70%

```md
:!img ipod-02.jpeg 70%
```

## Single Image: Manual Gallery

:!img ipod-03.jpeg 65% @ipod-single

```md
:!img ipod-03.jpeg 65% @ipod-single
```

## Single Image: Legacy Order

:!img ipod-04.jpeg ipod-legacy 55

```md
:!img ipod-04.jpeg ipod-legacy 55
```

## Flex: Inherited Auto Gallery

:!flex 90%
:!img ipod-05.jpeg
:!img ipod-06.jpeg
:!img ipod-07.jpeg
!:flex

```md
:!flex 90%
:!img ipod-05.jpeg
:!img ipod-06.jpeg
:!img ipod-07.jpeg
!:flex
```

## Flex: Manual Gallery

:!flex 85% @ipod-flex
:!img ipod-08.jpeg
:!img ipod-09.jpeg
!:flex

```md
:!flex 85% @ipod-flex
:!img ipod-08.jpeg
:!img ipod-09.jpeg
!:flex
```

## Grid: Square Cells

:!grid 3 2 1/1 90%
:!img ipod-10.jpeg
:!img ipod-11.jpeg
:!img ipod-12.jpeg
:!img ipod-13.jpeg
:!img ipod-14.jpeg
:!img ipod-15.jpeg
!:grid

```md
:!grid 3 2 1/1 90%
:!img ipod-10.jpeg
:!img ipod-11.jpeg
:!img ipod-12.jpeg
:!img ipod-13.jpeg
:!img ipod-14.jpeg
:!img ipod-15.jpeg
!:grid
```

## Grid: Manual Gallery and Wide Cells

:!grid 2 2 16/9 85% @ipod-grid-wide
:!img ipod-16.jpeg
:!img ipod-17.jpeg
:!img ipod-18.jpeg
:!img ipod-19.jpeg
!:grid

```md
:!grid 2 2 16/9 85% @ipod-grid-wide
:!img ipod-16.jpeg
:!img ipod-17.jpeg
:!img ipod-18.jpeg
:!img ipod-19.jpeg
!:grid
```

## Mosaic: Group Ratio

:!mosaic 90% 4/3
:!img ipod-20.jpeg
:/
:!img ipod-21.jpeg
:!img ipod-22.jpeg
:/
:!img ipod-23.jpeg
:!img ipod-24.jpeg
:!img ipod-25.jpeg
!:mosaic

```md
:!mosaic 90% 4/3
:!img ipod-20.jpeg
:/
:!img ipod-21.jpeg
:!img ipod-22.jpeg
:/
:!img ipod-23.jpeg
:!img ipod-24.jpeg
:!img ipod-25.jpeg
!:mosaic
```

## Mosaic: Row Ratios

:!mosaic 90%
:/ 16/9
:!img ipod-26.jpeg
:/ 1/1
:!img ipod-27.jpeg
:!img ipod-28.jpeg
:/ 4/3
:!img ipod-29.jpeg
:!img ipod-30.jpeg
:!img ipod-31.jpeg
!:mosaic

```md
:!mosaic 90%
:/ 16/9
:!img ipod-26.jpeg
:/ 1/1
:!img ipod-27.jpeg
:!img ipod-28.jpeg
:/ 4/3
:!img ipod-29.jpeg
:!img ipod-30.jpeg
:!img ipod-31.jpeg
!:mosaic
```

## Mosaic: Manual Gallery Override

:!mosaic 75% 3/2 @ipod-mosaic-manual
:!img ipod-32.jpeg
:/
:!img ipod-33.jpeg
!:mosaic

```md
:!mosaic 75% 3/2 @ipod-mosaic-manual
:!img ipod-32.jpeg
:/
:!img ipod-33.jpeg
!:mosaic
```

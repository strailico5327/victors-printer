---
title: Shortcut Layout Test
published: 2026-06-19
category: Tech
indev: true
proseStyle: literary
tags:
    - Test
    - Shortcuts
---

This draft post is used to test the image shortcut plugins.

Single image, default width:

:!img captured-01.jpg shortcut-test

Single image, custom width:

:!img captured-04.jpg shortcut-test 60

Flex row, mixed aspect ratios, uncropped:

:!flex 90
  :!img captured-01.jpg shortcut-flex
  :!img captured-02.jpg shortcut-flex
  :!img captured-04.jpg shortcut-flex
!:flex

Grid, square cells:

:!grid 3 2 1/1 90
  :!img captured-01.jpg shortcut-grid-square
  :!img captured-02.jpg shortcut-grid-square
  :!img captured-03.jpg shortcut-grid-square
  :!img captured-04.jpg shortcut-grid-square
  :!img captured-05.jpg shortcut-grid-square
  :!img captured-06.jpg shortcut-grid-square
!:grid

Grid, 16:9 cells:

:!grid 2 2 16/9 90
  :!img captured-01.jpg shortcut-grid-wide
  :!img captured-02.jpg shortcut-grid-wide
  :!img captured-04.jpg shortcut-grid-wide
  :!img captured-05.jpg shortcut-grid-wide
!:grid

# button

该目录集中管理项目内所有按钮控件与按钮相关元素（组件、样式、类型与测试）。

## 统一接口

- `Button`：统一按钮组件
- `ButtonGroup`：按钮排列容器

入口：`src/button/index.ts`

## 使用示例

```tsx
import { Button, ButtonGroup } from '../../button'

export function Demo() {
  return (
    <ButtonGroup>
      <Button onClick={() => {}}>确定</Button>
      <Button variant="danger">删除</Button>
    </ButtonGroup>
  )
}
```

## 约束

- 新增按钮必须使用 `Button`，禁止在页面/组件内直接写新的 `<button>` 及其样式
- 与按钮相关的视觉规范统一维护在 `src/button/styles/button.css`


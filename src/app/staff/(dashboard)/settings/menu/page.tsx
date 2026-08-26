import { getAllCategoriesWithItems } from "@/lib/data";
import { ErrorBanner } from "@/components/staff/ErrorBanner";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { PrintButton } from "@/components/staff/PrintButton";
import { SubmitButton } from "@/components/staff/SubmitButton";
import { ALLERGEN_CODES, ALLERGEN_LABEL, formatYen } from "@/lib/format";
import {
  addCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  addMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
} from "../actions";

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function MenuSettingsPage(props: PageProps<"/staff/settings/menu">) {
  const { error } = await props.searchParams;
  const categories = await getAllCategoriesWithItems();

  return (
    <div>
      <ErrorBanner error={typeof error === "string" ? error : undefined} />

      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted">カテゴリー・商品の追加、価格、販売状況を管理します。</p>
        <PrintButton className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground" />
      </div>

      <div className="hidden print:block">
        {categories.map((category) => {
          const available = category.menuItems.filter((i) => i.isAvailable);
          if (available.length === 0) return null;
          return (
            <div key={category.id} className="mb-6 break-inside-avoid">
              <h2 className="mb-2 border-b-2 border-black pb-1 text-lg font-bold">{category.name}</h2>
              <div className="space-y-1">
                {available.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.name}
                      {item.description ? `（${item.description}）` : ""}
                    </span>
                    <span>{formatYen(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="print:hidden">
      <div className="space-y-6">
        {categories.map((category) => (
          <details key={category.id} className="group rounded-2xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-foreground">{category.name}</span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">{category.menuItems.length}品</span>
              </div>
              <span className="text-muted transition-transform group-open:rotate-180">▾</span>
            </summary>

            <div className="border-t border-border p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <form action={renameCategoryAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={category.id} />
                <input
                  type="text"
                  name="name"
                  defaultValue={category.name}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-bold text-foreground"
                />
                <SubmitButton pendingText="保存中…" className="text-xs text-muted underline underline-offset-4">
                  名前を保存
                </SubmitButton>
              </form>
              <form action={deleteCategoryAction} className="ml-auto">
                <input type="hidden" name="id" value={category.id} />
                <ConfirmButton confirmText={`「${category.name}」を削除しますか？`} className="text-xs text-warning underline underline-offset-4">
                  カテゴリーを削除
                </ConfirmButton>
              </form>
            </div>

            <div className="space-y-3">
              {category.menuItems.map((item) => (
                <form
                  key={item.id}
                  action={updateMenuItemAction}
                  className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_100px_1fr_auto_auto_auto_auto]"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="text"
                    name="name"
                    defaultValue={item.name}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <input
                    type="number"
                    name="price"
                    defaultValue={item.price}
                    min={0}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <input
                    type="text"
                    name="description"
                    defaultValue={item.description ?? ""}
                    placeholder="説明（任意）"
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" name="isRecommended" defaultChecked={item.isRecommended} />
                    おすすめ
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable} />
                    販売中
                  </label>
                  <SubmitButton className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                    保存
                  </SubmitButton>
                  <ConfirmButton
                    confirmText={`「${item.name}」を削除しますか？`}
                    formAction={deleteMenuItemAction}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-warning"
                  >
                    削除
                  </ConfirmButton>

                  <div className="col-span-full flex flex-wrap gap-2 border-t border-border pt-2">
                    {ALLERGEN_CODES.map((code) => (
                      <label key={code} className="flex items-center gap-1 text-[11px] text-muted">
                        <input
                          type="checkbox"
                          name={`allergen_${code}`}
                          defaultChecked={item.allergens?.split(",").includes(code) ?? false}
                        />
                        {ALLERGEN_LABEL[code]}
                      </label>
                    ))}
                  </div>
                  <div className="col-span-full flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted">価格改定を予約:</span>
                    <input
                      type="number"
                      name="pendingPrice"
                      min={0}
                      placeholder="新価格"
                      defaultValue={item.pendingPrice ?? ""}
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                    />
                    <input
                      type="date"
                      name="applyAt"
                      defaultValue={item.applyAt ? toDateInputValue(item.applyAt) : ""}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                    />
                    <span className="text-[11px] text-muted">から適用（両方入力で有効）</span>
                  </div>
                  <div className="col-span-full flex items-center gap-2 border-t border-border pt-2">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    )}
                    <input
                      type="text"
                      name="imageUrl"
                      defaultValue={item.imageUrl ?? ""}
                      placeholder="商品写真のURL（任意）"
                      className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                    />
                  </div>
                </form>
              ))}
              {category.menuItems.length === 0 && <p className="text-xs text-muted">商品がありません</p>}
            </div>

            <form action={addMenuItemAction} className="mt-3 grid grid-cols-1 items-center gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_100px_1fr_auto_auto]">
              <input type="hidden" name="categoryId" value={category.id} />
              <input
                type="text"
                name="name"
                placeholder="商品名"
                required
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <input
                type="number"
                name="price"
                placeholder="価格"
                min={0}
                required
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <input
                type="text"
                name="description"
                placeholder="説明（任意）"
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" name="isRecommended" />
                おすすめ
              </label>
              <SubmitButton pendingText="追加中…" className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                商品を追加
              </SubmitButton>
              <div className="col-span-full flex flex-wrap gap-2">
                {ALLERGEN_CODES.map((code) => (
                  <label key={code} className="flex items-center gap-1 text-[11px] text-muted">
                    <input type="checkbox" name={`allergen_${code}`} />
                    {ALLERGEN_LABEL[code]}
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="imageUrl"
                placeholder="商品写真のURL（任意）"
                className="col-span-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </form>
            </div>
          </details>
        ))}
      </div>

      <form action={addCategoryAction} className="mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-4">
        <input
          type="text"
          name="name"
          placeholder="新しいカテゴリー名（例：デザート）"
          required
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <SubmitButton pendingText="追加中…" className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground">
          カテゴリーを追加
        </SubmitButton>
      </form>
      </div>
    </div>
  );
}


export async function execute(args: { multiplier: number; val: number }) {
  return { result: args.val * args.multiplier };
}

export type If<
  Condition extends boolean,
  True,
  False = True | undefined,
> = Condition extends true ? True : False;

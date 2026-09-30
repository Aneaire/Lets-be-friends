import { useClerk } from '@clerk/react'
import type { ButtonHTMLAttributes, MouseEvent } from 'react'

type SignInActionProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * A signed-out call to action that opens the Clerk sign-in modal instead of
 * navigating to a member-only destination. It renders a real button so the
 * action stays keyboard and screen-reader friendly.
 */
export function SignInAction({ type = 'button', onClick, ...props }: SignInActionProps) {
  const clerk = useClerk()

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (event.defaultPrevented) return
    void clerk.openSignIn()
  }

  return <button {...props} type={type} onClick={handleClick} />
}

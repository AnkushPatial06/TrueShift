from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.auth import Role
from app.schemas.leave import LeaveApplyRequest, LeaveBalanceOut, LeaveDecisionRequest, LeaveOut
from app.services.leave_service import LeaveService

router = APIRouter(prefix="/leaves", tags=["Leave Management"])


@router.post("", response_model=LeaveOut)
async def apply_leave(
    payload: LeaveApplyRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LeaveService(session)
    return await service.apply(current_user.id, payload)


@router.get("/mine", response_model=list[LeaveOut])
async def my_leaves(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LeaveService(session)
    return await service.list_mine(current_user.id)


@router.get("/balance", response_model=LeaveBalanceOut)
async def my_balance(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LeaveService(session)
    return await service.get_balance(current_user.id)


@router.get("/team", response_model=list[LeaveOut])
async def team_leaves(
    pending_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.HR, Role.MANAGER)),
):
    service = LeaveService(session)
    return await service.list_for_scope(current_user, pending_only)


@router.post("/{leave_id}/cancel", response_model=LeaveOut)
async def cancel_leave(
    leave_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LeaveService(session)
    return await service.cancel(leave_id, current_user)


@router.post("/{leave_id}/approve", response_model=LeaveOut)
async def approve_leave(
    leave_id: int,
    payload: LeaveDecisionRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.HR, Role.MANAGER)),
):
    service = LeaveService(session)
    return await service.decide(leave_id, True, current_user, payload.comment)


@router.post("/{leave_id}/reject", response_model=LeaveOut)
async def reject_leave(
    leave_id: int,
    payload: LeaveDecisionRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.HR, Role.MANAGER)),
):
    service = LeaveService(session)
    return await service.decide(leave_id, False, current_user, payload.comment)

from datetime import date
from pydantic import BaseModel
from app.models.leave import LeaveDelegation
from sqlalchemy import select

class DelegateRequest(BaseModel):
    delegate_id: int
    valid_from: date
    valid_to: date

@router.post("/delegate")
async def set_delegate(
    payload: DelegateRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delegation = LeaveDelegation(
        delegator_id=current_user.id,
        delegate_id=payload.delegate_id,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to
    )
    session.add(delegation)
    await session.commit()
    await session.refresh(delegation)
    return {"id": delegation.id, "delegate_id": delegation.delegate_id, "valid_from": delegation.valid_from, "valid_to": delegation.valid_to}

@router.get("/delegate")
async def get_delegate(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(LeaveDelegation).where(LeaveDelegation.delegator_id == current_user.id, LeaveDelegation.is_active == True)
    result = await session.execute(stmt)
    delegation = result.scalars().first()
    if not delegation:
        return None
    return {"id": delegation.id, "delegate_id": delegation.delegate_id, "valid_from": delegation.valid_from, "valid_to": delegation.valid_to}


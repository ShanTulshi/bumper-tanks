// Circle bodies vs rounded-rect world geometry.
// Signed distance from point to a rounded rect (negative = inside).
export function sdfRoundedRect(rect, x, y) {
    const qx = Math.abs(x - rect.cx) - (rect.w / 2 - rect.r);
    const qy = Math.abs(y - rect.cy) - (rect.h / 2 - rect.r);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rect.r;
}
export function pointInRoundedRect(rect, x, y) {
    return sdfRoundedRect(rect, x, y) <= 0;
}
// Is a point standing on the map? Inside any floor and not inside any hole.
export function supported(map, x, y) {
    for (const h of map.holes)
        if (pointInRoundedRect(h, x, y))
            return false;
    for (const f of map.floors)
        if (pointInRoundedRect(f, x, y))
            return true;
    return false;
}
// Distance from a supported point to the nearest dropoff (floor edge or hole
// edge). Negative when past the edge: how far off the floor the point is.
export function edgeMargin(map, x, y) {
    let best = -Infinity;
    for (const f of map.floors)
        best = Math.max(best, -sdfRoundedRect(f, x, y));
    for (const h of map.holes)
        best = Math.min(best, sdfRoundedRect(h, x, y));
    return best; // >0 means this many wu from the nearest edge
}
// Support test with ledge forgiveness: still supported while the center is no
// more than `grace` past the floor edge (or into a hole). Smooths the harsh
// notch corners where overlapping floor boxes meet.
export function supportedWithGrace(map, x, y, grace) {
    return edgeMargin(map, x, y) >= -grace;
}
// Circle vs solid rounded rect. Returns null or the push-out normal + depth
// (normal points away from the rect).
export function circleVsRoundedRect(x, y, radius, rect) {
    const hw = rect.w / 2 - rect.r;
    const hh = rect.h / 2 - rect.r;
    const dx = x - rect.cx;
    const dy = y - rect.cy;
    const cx = Math.max(-hw, Math.min(hw, dx));
    const cy = Math.max(-hh, Math.min(hh, dy));
    let nx = dx - cx;
    let ny = dy - cy;
    const distSq = nx * nx + ny * ny;
    const reach = rect.r + radius;
    if (distSq > reach * reach)
        return null;
    const dist = Math.sqrt(distSq);
    if (dist < 1e-6) {
        // Center inside the core box: push out along the shallower axis.
        const px = hw + reach - Math.abs(dx);
        const py = hh + reach - Math.abs(dy);
        if (px < py)
            return { nx: Math.sign(dx) || 1, ny: 0, depth: px };
        return { nx: 0, ny: Math.sign(dy) || 1, depth: py };
    }
    nx /= dist;
    ny /= dist;
    return { nx, ny, depth: reach - dist };
}
// Elastic collision response between two equal-mass circles.
// Mutates velocities; returns relative approach speed along the normal (0 if separating).
export function resolveCircleCircle(a, b, restitution) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = a.radius + b.radius - dist;
    if (overlap <= 0)
        return 0;
    // Positional correction, split evenly.
    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const approach = rvx * nx + rvy * ny;
    if (approach >= 0)
        return 0;
    const j = (-(1 + restitution) * approach) / 2; // equal masses
    a.vx -= j * nx;
    a.vy -= j * ny;
    b.vx += j * nx;
    b.vy += j * ny;
    return -approach;
}
// Reflect a circle off a solid rounded rect wall. Returns true if it hit.
export function bounceOffWall(body, rect, restitution) {
    const hit = circleVsRoundedRect(body.x, body.y, body.radius, rect);
    if (!hit)
        return false;
    body.x += hit.nx * hit.depth;
    body.y += hit.ny * hit.depth;
    const vn = body.vx * hit.nx + body.vy * hit.ny;
    if (vn < 0) {
        body.vx -= (1 + restitution) * vn * hit.nx;
        body.vy -= (1 + restitution) * vn * hit.ny;
    }
    return true;
}
export function angleLerpToward(current, target, maxDelta) {
    let diff = target - current;
    while (diff > Math.PI)
        diff -= Math.PI * 2;
    while (diff < -Math.PI)
        diff += Math.PI * 2;
    if (Math.abs(diff) <= maxDelta)
        return target;
    return current + Math.sign(diff) * maxDelta;
}
export function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI)
        d -= Math.PI * 2;
    while (d < -Math.PI)
        d += Math.PI * 2;
    return d;
}
